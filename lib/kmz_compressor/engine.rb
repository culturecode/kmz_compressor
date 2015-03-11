require 'kmz_compressor/controller_extensions'

module KMZCompressor
	class Engine < Rails::Engine

    initializer 'kmz_compressor.extend_application_controller' do |app|
      ApplicationController.extend ControllerExtensions::ClassMethods
      ApplicationController.include ControllerExtensions::InstanceMethods
    end

	end
end
