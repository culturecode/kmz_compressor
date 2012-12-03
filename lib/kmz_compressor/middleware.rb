module KMZCompressor
  class Middleware
    def initialize(app)
      @app = app
    end
  
    def call(env)
      request = Rack::Request.new(env)
      
      # If the User is asking for a KMZ file
      if request.path_info.end_with? '.kmz'
        # HACK: Firefox 'helps' us out by encoding apostrophes as %27 in AJAX requests, However its encodeURI method
        # does not. This difference causes a mismatch between the browser's cached KMZ path, and the server.
        # This hack undoes the damage. See https://bugzilla.mozilla.org/show_bug.cgi?id=407172
        recoded_uri = URI.encode(URI.decode(request.fullpath))

        # Use a hash of the request path (before we gsub it) as the filename we will save on the HD
        cache_path = "public/kmz/#{Digest::SHA2.hexdigest(recoded_uri)}.kmz"
        file_exists = File.exists?(cache_path)
        
        if file_exists
          status = 200
          headers = {'Last-Modified' => File.mtime(cache_path).httpdate}
          response = File.open(cache_path)
        else
          # Ask Rails for KML instead of KMZ
          request.path_info = request.path_info.gsub(/kmz\Z/, 'kml')
          status, headers, response = @app.call(env)
          status = status.to_i
        end

        if status == 200
          # Set the Content-Type to KMZ
          headers['Content-Type'] = 'application/vnd.google-earth.kmz'
        end
        
        if status == 200 && !file_exists
          # Zip the KML response and save it on the HD
          FileUtils.mkdir_p(File.dirname(cache_path))
          response = Zippy.create(cache_path) do |zip| 
            zip['doc.kml'] = response.body
          end
          response = [response.data]      
        end

        # Return the response to the next middleware in the chain
        [status, headers, response]
      else
        @app.call(env)
      end
    end
  end
end