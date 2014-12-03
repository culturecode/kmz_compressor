module KmzCompressor
  module KmlHelper
    # Converts KML colours which are BBGGRR into web colours which are RRGGBB
    def kml_colour(html_hex_colour)
      html_hex_colour.gsub(/([0-9A-F][0-9A-F])([0-9A-F][0-9A-F])([0-9A-F][0-9A-F])/i, '\3\2\1')
    end
  end
end
