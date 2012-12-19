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
        kmlPath = encodeURI(kmlPath);
        
        $.ajax(this.host + kmlPath, {type:'head', complete:function(){
            if (!MapLayerManager.requestTimestamps[layerName] || MapLayerManager.requestTimestamps[layerName] < requestTimestamp){
                MapLayerManager.requestTimestamps[layerName] = requestTimestamp;
                MapLayerManager.loadKMLLayer(map, MapLayerManager.cachedKMZPath(kmlPath), layerName, options)
            }            
        }});
    },
    loadKMLLayer: function(map, kmlPath, layerName, options) {
        // Replace spaces with pluses so we don't have problems with some things turning them into %20s and some not
        kmlPath = encodeURI(kmlPath);
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
        return $(this.layers).map(function(){return this.name})
    },
    addLayer: function(layerName, kml){
      this.layers.unshift({name:layerName, kml:kml})
      return this.layers[0]
    },
    getLayer: function(layerName){
        for (var i = 0; i < this.layers.length; i++){
            if (this.layers[i].name == layerName){
                return this.layers[i];
            }
        }
    },
    // Shows the layer and returns true, returns false if the layer couldn't be hidden
    hideLayer: function(layerName){
        var layer = this.getLayer(layerName);
        if (layer && layer.kml){
            layer.oldMap = layer.kml.getMap();
            layer.kml.setMap(null)
            return true
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
        var layer;
        while (layer = this.getLayer(layerName)){
            layer.kml.setMap(null)
            this.layers.splice($.inArray(layer, this.layers), 1);                
        }
    },
    removeLayers: function(){
        for (var i = 0; i < this.layers.length; i++){
            this.removeLayer(this.layers[i].name);
        }
    },
    everyLayer: function(fn){
        for (var i = 0; i < this.layers.length; i++){
            fn(this.layers[i]);
        }
    },
    // Keep everything in sync
    sweep: function(){
        var foundLayers = [];
        for (var i = 0; i < this.layers.length; i++){
            var layer = this.layers[i]
            var kmlStatus = layer.kml ? layer.kml.getStatus() : null;
            
            // If the layer just finished loading
            if (!layer.loaded && kmlStatus) {
                this.loadingCount--
                layer.loaded = true                
                layer.error = kmlStatus == 'OK' ? null : kmlStatus // if there were any errors, record them
                $(window.document).trigger({type: this.layerLoadedEventName, layer:layer})
            }
    
            // Remove old layers
            if ($.inArray(layer.name, foundLayers) > -1){
                layer.kml.setMap(null);
                this.layers.splice(i, 1);
            } else if (layer.loaded) {
                foundLayers.push(layer.name)
            }
        }
    }
};

// Because google events sometimes get missed, we ensure we're up to date every now and again
setInterval(function(){MapLayerManager.sweep()}, 1000)