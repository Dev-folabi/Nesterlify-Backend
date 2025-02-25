// import { Duffel } from '@duffel/api';
// import axios from 'axios';
// import { Request, Response } from 'express';

// // Initialize Duffel API
// const duffel = new Duffel({
//   token: 'duffel_test_rvtiZjvWiLHbp7svOmWW9nEeef7aQQN5t_piCBLiJ2a',
// });

// // Type for geocode response
// interface GeocodeResult {
//   latitude: number;
//   longitude: number;
// }

// // Function to get geolocation coordinates using Nominatim
// const getGeocode = async (location: string): Promise<GeocodeResult> => {
//   try {
//     const response = await axios.get('https://nominatim.openstreetmap.org/search', {
//       params: { q: location, format: 'json', addressdetails: 1 },
//     });

//     if (!response.data || response.data.length === 0) {
//       throw new Error('Location not found');
//     }

//     const result = response.data[0];
//     return { latitude: parseFloat(result.lat), longitude: parseFloat(result.lon) };
//   } catch (error: any) {
//     throw new Error(`Failed to get geocode: ${error.message}`);
//   }
// };

// // Type for search request body
// interface SearchRequestBody {
//   rooms: number;
//   guests: number;
//   check_in_date: string;
//   check_out_date: string;
//   location: string;
//   radius?: number;
// }

// // Search for hotels
// export const findHotels = async (req: Request<{}, {}, SearchRequestBody>, res: Response) => {
//   const { rooms, guests, check_in_date, check_out_date, location, radius = 2 } = req.body;

//   if (!rooms || !guests || !check_in_date || !check_out_date || !location) {
//     return res.status(400).json({ error: 'Missing required fields' });
//   }

//   try {
//     const { latitude, longitude } = await getGeocode(location);

//     const searchParams = {
//       rooms,
//       guests,
//       check_in_date,
//       check_out_date,
//       location: {
//         radius,
//         geographic_coordinates: { latitude, longitude },
//       },
//     };

//     const result = await duffel.stays.search(searchParams);

//     res.json({ length: result.data.results.length, result: result.data });
//   } catch (error: any) {
//     console.error(error);
//     res.status(500).json({ error: error.message || 'Internal Server Error' });
//   }
// };

// // Type for fetch room rates request
// interface FetchRoomRatesRequest {
//   search_result_id: string;
// }

// // Fetch room rates
// export const fetchRoomRates = async (req: Request<{}, {}, FetchRoomRatesRequest>, res: Response) => {
//   const { search_result_id } = req.body;
//   if (!search_result_id) {
//     return res.status(400).json({ error: 'Missing search_result_id' });
//   }

//   try {
//     const rates = await duffel.stays.searchResults.fetchAllRates({ search_result_id });

//     res.json(rates.data);
//   } catch (error: any) {
//     console.error(error);
//     res.status(500).json({ error: error.message || 'Internal Server Error' });
//   }
// };

// // Type for recheck request
// interface RecheckRateRequest {
//   rate_id: string;
// }

// // Recheck rate
// export const recheckRate = async (req: Request<{}, {}, RecheckRateRequest>, res: Response) => {
//   const { rate_id } = req.body;
//   if (!rate_id) {
//     return res.status(400).json({ error: 'Missing rate_id' });
//   }

//   try {
//     const quote = await duffel.stays.quotes.create({ rate_id });
//     res.json(quote.data);
//   } catch (error: any) {
//     console.error(error);
//     res.status(500).json({ error: error.message || 'Internal Server Error' });
//   }
// };

// // Type for booking request
// interface BookHotelRequest {
//   quote_id: string;
//   phone_number: string;
//   guests: { given_name: string; family_name: string }[];
//   email: string;
//   accommodation_special_requests?: string[];
// }

// // Book a hotel
// export const bookHotel = async (req: Request<{}, {}, BookHotelRequest>, res: Response) => {
//   const { quote_id, phone_number, guests, email, accommodation_special_requests } = req.body;

//   if (!quote_id || !phone_number || !guests || !email) {
//     return res.status(400).json({ error: 'Missing required fields: quote_id, phone_number, guests, or email' });
//   }

//   try {
//     const booking = await duffel.stays.bookings.create({
//       quote_id,
//       phone_number,
//       guests,
//       email,
//       accommodation_special_requests,
//     });

//     res.json(booking.data);
//   } catch (error: any) {
//     console.error(error);
//     res.status(500).json({ error: error.message || 'Internal Server Error' });
//   }
// };
