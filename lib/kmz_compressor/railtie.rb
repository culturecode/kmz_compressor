require 'zippy'
require 'kmz_compressor/middleware'

module KMZCompressor
  class Railtie < Rails::Railtie
    initializer "kmz_compressor.init" do |app|
      app.config.middleware.use "KMZCompressor::Middleware"
    end
  end
end