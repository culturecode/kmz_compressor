require 'digest'

module KMZCompressor
  module ControllerExtensions

    module ClassMethods
      def defer_until_kmz_cached(*actions)
        around_filter :render_202_while_caching, :only => actions
      end
    end

    module InstanceMethods
      # Subsequent calls to this action return a 202 while the original result is being cached
      def render_202_while_caching(&action)
        cache_key = [:kmz_in_progress, Digest::SHA256.base64digest(params.inspect)]

        if Rails.cache.exist?(cache_key)
          render :status => 202, :nothing => true
        else
          begin
            Rails.cache.write(cache_key, true, :expires_in => 1.hour) # Expire in case we somehow leave the cache key behind
            action.call
          ensure
            # Rails.cache.delete(cache_key)
          end
        end
      end
    end

  end
end
