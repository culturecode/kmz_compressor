MapLayerManager = {
    host:  location.protocol + "//" + location.host,
    layers: [],
    loadingCount: 0, // How many layers are being loaded
    requestTimestamps: { },
    layerLoadingEventName: 'map:layerLoading',
    layerLoadedEventName: 'map:layerLoaded',

    // Prime the KMZ cache on the server before unleashing google's many tilemills
    cacheAndLoadKMLLayer: function(map, kmlPath, layerName, options) {
        var requestTimestamp = new Date;
        kmlPath = this.sanitizeURI(kmlPath);

        $.ajax(this.host + kmlPath, {type:'head', complete:function(){
            if (!MapLayerManager.requestTimestamps[layerName] || MapLayerManager.requestTimestamps[layerName] < requestTimestamp){
                MapLayerManager.requestTimestamps[layerName] = requestTimestamp;
                MapLayerManager.loadKMLLayer(map, MapLayerManager.cachedKMZPath(kmlPath), layerName, options)
            }            
        }});
    },
    loadKMLLayer: function(map, kmlPath, layerName, options) {
        // Replace spaces with pluses so we don't have problems with some things turning them into %20s and some not
        kmlPath = this.sanitizeURI(kmlPath);
        options = options || {}
        options.map = map;
        
        var kmlLayer = new google.maps.KmlLayer(this.host + kmlPath, options);
        var layer = MapLayerManager.addLayer(layerName, kmlLayer)
        this.loadingCount++
        $(window.document).trigger({type: this.layerLoadingEventName, layer:layer})

        // Try and catch the defaultviewport_changed event so we can remove the old layer (sometimes this works, sometimes not)
        google.maps.event.addListener(kmlLayer, 'defaultviewport_changed', function(){
            MapLayerManager.sweep();
        });

        // Add a listener to catch clicks and close all info windows on other layers
        google.maps.event.addListener(kmlLayer, 'click', function(){
            MapLayerManager.everyLayer(function(layer){
                if (layer.kml != kmlLayer){ // Don't close this layer's info window
                    layer.kml.setOptions({suppressInfoWindows:true})
                    layer.kml.setOptions({suppressInfoWindows:false})
                }
            })
        });
    },    
    // Generates the url of the cached KMZ for the given kmlPath
    cachedKMZPath: function(kmlPath){
        return '/kmz/' + hex_sha256(kmlPath) + '.kmz'
    },
    centerWhenLoaded: function(map, layerNames){    
        var handler = function(){
            // If we have no layer names
            if (!layerNames || layerNames.length == 0){
                layerNames = MapLayerManager.layerNames()
            }

            if (MapLayerManager.layersLoaded(layerNames)){
                $(window.document).unbind(MapLayerManager.layerLoadedEventName, handler)
                MapLayerManager.centerOnLayers(map, layerNames);
            }
        }

        $(window.document).bind(this.layerLoadedEventName, handler)
    },
    // Returns the layer names
    layerNames: function(){
        return $(this.layers.slice(0)).map(function(){return this.name})
    },
    addLayer: function(layerName, kml){
      this.layers.unshift({name:layerName, kml:kml})
      return this.layers[0]
    },
    getLayer: function(layerName){
        var desiredLayer
        this.everyLayer(function(layer, index){
            if (layer.name == layerName){
                desiredLayer = layer
                return false;
            }
        })
        return desiredLayer
    },
    // Shows the layer and returns true, returns false if the layer couldn't be hidden
    hideLayer: function(layerName){
        var layer = this.getLayer(layerName);
        if (layer && layer.kml){
            layer.oldMap = layer.kml.getMap();
            layer.kml.setMap(null)
            layer.hidden = true
            return true
        } else if (layer) {
            layer.hidden = true
        } else {
            return false
        }
    },
    // Shows the layer and returns true, returns false if the layer couldn't be shown
    showLayer: function(layerName){
        var layer = this.getLayer(layerName);
        if (layer && layer.kml && layer.oldMap){
            layer.kml.setMap(layer.oldMap);
            layer.oldMap = null
            layer.hidden = false
            return true
        } else {
            return false
        }
    },
    layersLoaded: function(layerNames){
        for (var i = 0; i < layerNames.length; i++){
            var layer = this.getLayer(layerNames[i]);
            if (!layer || !layer.loaded){
                return false;
            }
        }
        return true
    },
    centerOnLayers: function(map, layerNames){
        var bounds;

        for (var i = 0; i < layerNames.length; i++){
            var layer = this.getLayer(layerNames[i])
            if (layer.error){
                continue
            }

            if (layer.kml.getDefaultViewport().toSpan().toString() != "(180, 360)"){
                bounds = bounds || layer.kml.getDefaultViewport();
                bounds.union(layer.kml.getDefaultViewport());                
            }
        }
        if (bounds){
            map.fitBounds(bounds);            
        }
    },
    removeLayer: function(layerName){
        this.everyLayer(function(layer, index){
            layer.kml.setMap(null)
            MapLayerManager.layers.splice(index, 1);                
        });
    },
    removeLayers: function(){
        this.everyLayer(function(layer){
            MapLayerManager.removeLayer(layer.name);
        })
    },
    everyLayer: function(fn){
        // NOTE: We use an iterator instead of a for loop because modifications to this.layers that occur during iteration can mess us up
        //       e.g. if we're responding to an event during the loop and the event adds a layer, we may end up re-iterating on a layer we've already processed
        $.each(this.layers.slice(0), function(index, layer){
            fn(layer, index);
        })
    },

    // Keep layers synced with their state
    sweep: function(){
        var foundLayers = [];        
        this.everyLayer(function(layer, index){
            var kmlStatus = layer.kml ? layer.kml.getStatus() : null;
            
            // If the layer just finished loading
            if (!layer.loaded && kmlStatus) {
                MapLayerManager.loadingCount--
                layer.loaded = true                
                layer.error = kmlStatus == 'OK' ? null : kmlStatus // if there were any errors, record them
                $(window.document).trigger({type: MapLayerManager.layerLoadedEventName, layer:layer})
            }

            // A layer should be hidden, but the kml is showing, hide it (i.e. correct layers that were hidden before the kml was loaded)
            if (layer.hidden && layer.loaded && layer.kml.getMap()){
                MapLayerManager.hideLayer(layer.name)
            }
    
            // Remove old layers
            // Sweep through layers from the newest to oldest, if a layer name is seen more than once, delete all but the newest
            // Don't delete an instance if we haven't yet seen a version of it with status 'OK'
            if ($.inArray(layer.name, foundLayers) > -1){
                layer.kml.setMap(null);
                MapLayerManager.layers.splice(index, 1);
            } else if (layer.loaded) {
                foundLayers.push(layer.name)
            }
        })
    },
    sanitizeURI: function(uri){
      // Replace spaces with pluses so we don't have problems with some things turning them into %20s and some not
      // Matches the middleware process
      return encodeURI(decodeURI(uri))
    }
};

// Because google events sometimes get missed, we ensure we're up to date every now and again
setInterval(function(){MapLayerManager.sweep()}, 1000)