require 'fileutils'
require 'digest'
require 'zip'
require 'kmz_compressor/middleware'

module KMZCompressor
  class Railtie < Rails::Railtie
    initializer "kmz_compressor.init" do |app|
      app.config.middleware.use KMZCompressor::Middleware

      Mime::Type.register "application/vnd.google-earth.kml+xml", :kml
    end
  end
end
