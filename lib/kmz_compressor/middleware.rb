module KMZCompressor
  class Middleware
    def initialize(app)
      @app = app
    end
  
    def call(env)
      @request = Rack::Request.new(env)
      @cache_path = "public/#{@request.path_info}"
      
      if @request.path_info.end_with? '.kmz'
        @request.path_info = @request.path_info.gsub(/kmz\Z/, 'kml')

        @status, @headers, @response = @app.call(env)

        [@status, @headers, self]
      else
        @app.call(env)
      end
    end

    def each(&block)
      FileUtils.mkdir_p(File.dirname(@cache_path))
      kmz = Zippy.create(@cache_path) do |zip| 
        zip['doc.kml'] = @response.body
      end
      
      block.call(kmz.data)
    end
  end
end