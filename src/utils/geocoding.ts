import axios from "axios";
import logger from "./logger";

/**
 * Interface for geocode result
 */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/**
 * Interface for geocode result with string coordinates (alternative format)
 */
export interface GeocodeResultString {
  lat: string;
  lon: string;
}

/**
 * Get geographic coordinates (latitude and longitude) for a given location
 * using the Nominatim API (OpenStreetMap)
 *
 * @param location - The location string to geocode (e.g., "Paris, France", "New York")
 * @returns Promise resolving to GeocodeResult with latitude and longitude as numbers
 * @throws Error if location is not found or API request fails
 *
 * @example
 * const coords = await getGeocode("London, UK");
 * console.log(coords); // { latitude: 51.5074, longitude: -0.1278 }
 */
export const getGeocode = async (location: string): Promise<GeocodeResult> => {
  try {
    const response = await axios.get(
      `${process.env.NOMINATIM_BASE_URL}/search`,
      {
        params: {
          q: location,
          format: "json",
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "Nesterlify-Backend/1.0 (contact@nesterlify.com)",
        },
      }
    );

    if (!response.data || response.data.length === 0) {
      throw new Error(`Location not found: ${location}`);
    }

    const result = response.data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
  } catch (error: any) {
    logger.error(`Failed to get geocode for "${location}":`, error.message);
    throw new Error(`Failed to get geocode: ${error.message}`);
  }
};

/**
 * Get geographic coordinates (latitude and longitude) for a given location
 * Returns string format coordinates or null if not found
 *
 * @param location - The location string to geocode
 * @returns Promise resolving to GeocodeResultString with lat/lon as strings, or null if not found
 *
 * @example
 * const coords = await getGeocodeString("Paris");
 * if (coords) {
 *   console.log(coords); // { lat: "48.8566", lon: "2.3522" }
 * }
 */
export const getGeocodeString = async (
  location: string
): Promise<GeocodeResultString | null> => {
  try {
    const url = `${process.env.NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(location)}&format=json`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Nesterlify-Backend/1.0 (contact@nesterlify.com)",
      },
    });

    if (response.data.length > 0) {
      return {
        lat: response.data[0].lat,
        lon: response.data[0].lon,
      };
    }
    return null;
  } catch (error: any) {
    logger.error(`Error fetching geocode for "${location}":`, error.message);
    return null;
  }
};
