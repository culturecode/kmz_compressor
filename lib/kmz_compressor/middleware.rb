module KMZCompressor
  class Middleware
    def initialize(app)
      @app = app
    end
  
    def call(env)
      req = Rack::Request.new(env)

      if req.path_info.end_with? '.kmz'
        req.path_info = req.path_info.gsub(/kmz\Z/, 'kml')

        @status, @headers, @response = @app.call(env)

        [@status, @headers, self]
      else
        @app.call(env)
      end
    end

    def each(&block)
      block.call(Zippy.new {|zip| zip['doc.kml'] = @response.body }.data)
    end
  end
end