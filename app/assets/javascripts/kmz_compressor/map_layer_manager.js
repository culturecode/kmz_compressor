MapLayerManager = {
    host:  location.protocol + "//" + location.host,
    layers: [],
    requestTimestamps: { },

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
        MapLayerManager.addLayer(layerName, kmlLayer)
        
        google.maps.event.addListener(kmlLayer, 'status_changed', function(){
            MapLayerManager.sweep();
        });
    },    
    // Generates the url of the cached KMZ for the given kmlPath
    cachedKMZPath: function(kmlPath){
        return '/kmz/' + hex_sha256(kmlPath) + '.kmz'
    },
    centerWhenLoaded: function(map, layerNames){
        var centeringInterval;
        if (!layerNames || layerNames.length == 0){
            layerNames = $(this.layers).map(function(){return this.name})
        }

        centeringInterval = setInterval(function(){
            if (MapLayerManager.layersLoaded(layerNames)){
                clearInterval(centeringInterval);
                MapLayerManager.centerOnLayers(map, layerNames);
            }
        }, 100)
    },
    addLayer: function(layerName, kml){
      this.layers.unshift({name:layerName, kml:kml})  
    },
    getLayer: function(layerName){
        for (var i = 0; i < this.layers.length; i++){
            if (this.layers[i].name == layerName){
                return this.layers[i];
            }
        }
    },
    layersLoaded: function(layerNames){
        for (var i = 0; i < layerNames.length; i++){
            var layer = this.getLayer(layerNames[i]);
            if (!(layer && layer.kml && layer.kml.getStatus() == 'OK')){
                return false;
            }
        }
        return true
    },
    centerOnLayers: function(map, layerNames){
        var bounds;

        for (var i = 0; i < layerNames.length; i++){
            var kml = this.getLayer(layerNames[i]).kml;
            if (kml.getDefaultViewport().toString() != "((-90, 180), (90, -180))"){
                bounds = bounds || kml.getDefaultViewport();
                bounds.union(kml.getDefaultViewport());                
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
    // Remove all stale layers
    sweep: function(){
        var foundLayers = [];
        for (var i = 0; i < this.layers.length; i++){
            var layer = this.layers[i]
            if ($.inArray(layer.name, foundLayers) > -1){
                layer.kml.setMap(null);
                this.layers.splice(i, 1);
            } else if (layer.kml.status == 'OK') {
                foundLayers.push(layer.name)
            }
        }
    }
};