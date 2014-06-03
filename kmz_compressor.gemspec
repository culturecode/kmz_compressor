$:.push File.expand_path("../lib", __FILE__)

# Maintain your gem's version:
require "kmz_compressor/version"

# Describe your gem and declare its dependencies:
Gem::Specification.new do |s|
  s.name        = "kmz_compressor"
  s.version     = KMZCompressor::VERSION
  s.authors     = ["Ryan Wallace", "Nicholas Jakobsen"]
  s.email       = ["contact@culturecode.ca"]
  s.homepage    = "http://github.com/culturecode/kmz_compressor"
  s.summary     = "Rack Middleware which retrieves KML from Rails and produces KMZ for the client."
  s.description = "Rack Middleware which retrieves KML from Rails and produces KMZ for the client."

  s.files = Dir["{app}/**/*"] + Dir["{lib}/**/*"] + ["MIT-LICENSE", "README.rdoc"]

  s.add_dependency "rails", [">= 3.1", "< 4.1.0"]
  s.add_dependency "rubyzip", "~> 1.1.4"
end
