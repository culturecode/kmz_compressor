require 'fileutils'
require 'digest'
require 'zip'
require 'kmz_compressor/middleware'

module KMZCompressor
  class Railtie < Rails::Railtie
    initializer "kmz_compressor.init" do |app|
      # Google Earth Desktop doesn't support Zip64, so we need to disable it in rubyzip
      Zip.write_zip64_support = false

      app.config.middleware.use KMZCompressor::Middleware

      Mime::Type.register "application/vnd.google-earth.kml+xml", :kml
    end
  end
end
