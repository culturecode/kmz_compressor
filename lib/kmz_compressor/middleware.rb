module KMZCompressor
  class Middleware
    def initialize(app)
      @app = app
    end
  
    def call(env)
      request = Rack::Request.new(env)
      
      # If the User is asking for a KMZ file
      if request.path_info.end_with? '.kmz'
        # Use a hash of the request path (before we gsub it) as the filename we will save on the HD
        cache_path = "public/kmz/#{Digest::SHA2.hexdigest(request.fullpath)}.kmz"
        
        # Ask Rails for KML instead of KMZ
        request.path_info = request.path_info.gsub(/kmz\Z/, 'kml')
        status, headers, response = @app.call(env)
        
        # Zip the KML response and save it on the HD
        FileUtils.mkdir_p(File.dirname(cache_path))
        kmz = Zippy.create(cache_path) do |zip| 
          zip['doc.kml'] = response.body
        end

        # Return the response to the next middleware in the chain
        [status, headers, [kmz.data]]
      else
        @app.call(env)
      end
    end
  end
end