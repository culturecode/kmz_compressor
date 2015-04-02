require 'kmz_compressor/controller_extensions'

module KMZCompressor
	class Engine < Rails::Engine

    initializer 'kmz_compressor.load_controller_extensions' do |app|
      ActiveSupport.on_load(:action_controller) do
        extend ControllerExtensions::ClassMethods
        include ControllerExtensions::InstanceMethods
      end
    end

	end
end
