window.MapLayerManager = function(map){
  var map                   = map;
  var host                  = location.protocol + "//" + location.host
  var layers                = []
  var loadingCount          = 0 // How many layers are being loaded
  var requestTimestamps     = {}
  var layerLoadingEventName = 'map:layerLoading'
  var layerLoadedEventName  = 'map:layerLoaded'

  // Prime the KMZ cache on the server before unleashing google's many tilemills
  function cacheAndLoadKMLLayer(kmlPath, layerName, options) {
    var requestTimestamp = new Date;
    kmlPath = sanitizeURI(kmlPath);

    $.ajax(host + kmlPath, {type:'head', complete:function(){
        if (!requestTimestamps[layerName] || requestTimestamps[layerName] < requestTimestamp){
            requestTimestamps[layerName] = requestTimestamp;
            loadKMLLayer(cachedKMZPath(kmlPath), layerName, options)
        }
    }});
  }

  function loadKMLLayer(kmlPath, layerName, options) {
      // Replace spaces with pluses so we don't have problems with some things turning them into %20s and some not
      kmlPath = sanitizeURI(kmlPath);
      options = options || {}
      options.map = map;

      var kmlLayer = new google.maps.KmlLayer(host + kmlPath, options);
      var layer = addLayer(layerName, kmlLayer)
      loadingCount++
      $(window.document).trigger({type: layerLoadingEventName, layer:layer})

      // Try and catch the defaultviewport_changed event so we can remove the old layer (sometimes this works, sometimes not)
      google.maps.event.addListener(kmlLayer, 'defaultviewport_changed', function(){
          sweep();
      });

      // Add a listener to catch clicks and close all info windows on other layers
      google.maps.event.addListener(kmlLayer, 'click', function(){
          everyLayer(function(layer){
              if (layer.kml != kmlLayer){ // Don't close this layer's info window
                  layer.kml.setOptions({suppressInfoWindows:true})
                  layer.kml.setOptions({suppressInfoWindows:false})
              }
          })
      });
  }

  // Generates the url of the cached KMZ for the given kmlPath
  function cachedKMZPath(kmlPath){
    return '/kmz/' + hex_sha256(kmlPath) + '.kmz'
  }

  function centerWhenLoaded(layerNamez){
      var handler = function(){
          // If we have no layer names
          if (!layerNamez || layerNamez.length == 0){
              layerNamez = layerNames()
          }

          if (layersLoaded(layerNamez)){
              $(window.document).unbind(layerLoadedEventName, handler)
              centerOnLayers(layerNamez);
          }
      }

      $(window.document).bind(layerLoadedEventName, handler)
  }

  // Returns the layer names
  function layerNames(){
      return $(layers.slice(0)).map(function(){return name})
  }

  function addLayer(layerName, kml){
    layers.unshift({name:layerName, kml:kml})
    return layers[0]
  }

  function getLayer(layerName){
    var desiredLayer
    everyLayer(function(layer, index){
        if (layer.name == layerName){
            desiredLayer = layer
            return false;
        }
    })
    return desiredLayer
  }

  // Hides the layer and returns true, returns false if the layer couldn't be hidden, returns nothing if the layer existed but the kml hadn't yet been loaded
  function hideLayer(layerName){
      var layer = getLayer(layerName);
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
  }

  // Shows the layer and returns true, returns false if the layer couldn't be shown
  function showLayer(layerName){
      var layer = getLayer(layerName);
      if (layer && layer.kml && layer.oldMap){
          layer.kml.setMap(layer.oldMap);
          layer.oldMap = null
          layer.hidden = false
          return true
      } else {
          return false
      }
  }

  function layersLoaded(layerNames){
      for (var i = 0; i < layerNames.length; i++){
          var layer = getLayer(layerNames[i]);
          if (!layer || !layer.loaded){
              return false;
          }
      }
      return true
  }

  function centerOnLayers(layerNames){
      var bounds;

      for (var i = 0; i < layerNames.length; i++){
          var layer = getLayer(layerNames[i])
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
  }

  function removeLayer(layerName){
      everyLayer(function(layer, index){
        if (layer.name == layerName){
          layer.kml.setMap(null)
          layers.splice(index, 1);
          return;
        }
      });
  }

    function removeLayers(){
        everyLayer(function(layer){
            removeLayer(layer.name);
        })
    }
    function everyLayer(fn){
        // NOTE: We use an iterator instead of a for loop because modifications to layers that occur during iteration can mess us up
        //       e.g. if we're responding to an event during the loop and the event adds a layer, we may end up re-iterating on a layer we've already processed
        $.each(layers.slice(0), function(index, layer){
            fn(layer, index);
        })
    }

    // Keep layers synced with their state
    function sweep(){
        var foundLayers = [];
        everyLayer(function(layer, index){
            var kmlStatus = layer.kml ? layer.kml.getStatus() : null;

            // If the layer just finished loading
            if (!layer.loaded && kmlStatus) {
                loadingCount--
                layer.loaded = true
                layer.error = kmlStatus == 'OK' ? null : kmlStatus // if there were any errors, record them
                $(window.document).trigger({type: layerLoadedEventName, layer:layer})
            }

            // A layer should be hidden, but the kml is showing, hide it (i.e. correct layers that were hidden before the kml was loaded)
            if (layer.hidden && layer.loaded && layer.kml.getMap()){
                hideLayer(layer.name)
            }

            // Remove old layers
            // Sweep through layers from the newest to oldest, if a layer name is seen more than once, delete all but the newest
            // Don't delete an instance if we haven't yet seen a version of it with status 'OK'
            if ($.inArray(layer.name, foundLayers) > -1){
                layer.kml.setMap(null);
                layers.splice(index, 1);
            } else if (layer.loaded) {
                foundLayers.push(layer.name)
            }
        })
    }

    // Replace spaces with pluses so we don't have problems with some things turning them into %20s and some not
    // Matches the middleware process
    function sanitizeURI(uri){
      var url = $('<a href="' + uri + '"/>')[0]
      var pathname = decodeURI(url.pathname).trim().replace(/^\/\//, '/') // IE will return a path name with a leading double slash, so ensure it's only a single slash
      var search = decodeURIComponent(url.search.replace(/\+/g, '%20')).trim().replace(/^\?/, '') // Ensure all "plus spaces" are hex encoded spaces

      output = pathname

      if (search !== ''){
        output += '?'
      }

      // Encode the individual uri components
      output += $.map(search.split('&'), function(component){
        return $.map(component.split('='), function(kv){
          // HACK: Firefox 'helps' us out by encoding apostrophes as %27 in AJAX requests, However its encodeURIcomponent method
          // does not. This difference causes a mismatch between the url we use to calculate the cache path in the browser
          // and on the server. This hack undoes the damage. See https://bugzilla.mozilla.org/show_bug.cgi?id=407172
          return encodeURIComponent(kv).replace(/'/g, '%27')
        }).join('=')
      }).join('&')

      return output
    }


  // INIT

  // Because google events sometimes get missed, we ensure we're up to date every now and again
  setInterval(sweep, 1000)


  // PUBLIC INTERFACE

  return {cacheAndLoadKMLLayer:cacheAndLoadKMLLayer, loadKMLLayer:loadKMLLayer, centerWhenLoaded:centerWhenLoaded, addLayer:addLayer, removeLayer:removeLayer, map:map, loadingCount:loadingCount}
}
