const { Duffel } = require('@duffel/api');
const axios = require('axios');



const duffel = new Duffel({
  token: 'duffel_test_rvtiZjvWiLHbp7svOmWW9nEeef7aQQN5t_piCBLiJ2a',
});




const OPEN_CAGE_API_KEY = 'a0cb56de704a4c1686d41d08582338e4';

const getGeocode = async (location) => {
  try {
    const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
      params: {
        q: location,
        key: OPEN_CAGE_API_KEY,
        language: 'en',
        pretty: 1,
      },
    });
    const result = response.data.results[0];
    if (result) {
      const { lat, lng } = result.geometry;
      return { latitude: lat, longitude: lng };
    } else {
      throw new Error('Location not found');
    }
  } catch (error) {
    throw new Error('Failed to get geocode: ' + error.message);
  }
};

exports.find =  async (req, res) => {
  const { rooms, guests, check_in_date, check_out_date, location } = req.body;

  if (!rooms || !guests || !check_in_date || !check_out_date || !location) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { latitude, longitude } = await getGeocode(location);

    const searchParams = {
      rooms: rooms,
      guests: guests,
      check_in_date: check_in_date,
      check_out_date: check_out_date,
      location: {
        radius: location.radius || 2, 
        geographic_coordinates: {
          latitude: latitude,
          longitude: longitude,
        },
      },
    };


    const result = await duffel.stays.search(searchParams);

    res.json({length:result.data.results.length, result});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error});
  }
}


exports.fetchRoomRates = async (req, res) => {
    const { search_result_id } = req.body;
    if (!search_result_id) {
      return res.status(400).json({ error: 'Missing search_result_id' });
    }
  
    try {
      const rates = await duffel.stays.searchResults.fetchAllRates(search_result_id);

      res.json(rates);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error});
    }
  }



  exports.recheck =  async (req, res) => {
    const { rate_id } = req.body;
    if (!rate_id) {
      return res.status(400).json({ error: 'Missing rate_id' });
    }
  
    try {
      const quote = await duffel.stays.quotes.create(rate_id);
      res.json(quote);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error});
    }
  };



exports.book =  async (req, res) => {
    const {
      quote_id,
      phone_number,
      guests,
      email,
      accommodation_special_requests
    } = req.body;
  
    if (!quote_id || !phone_number || !guests || !email) {
      return res.status(400).json({ error: 'Missing required fields: quote_id, phone_number, guests, or email' });
    }
  
    try {
   
      const booking = await duffel.stays.bookings.create({
        quote_id: quote_id,
        phone_number: phone_number,
        guests: guests,
        email: email,
        accommodation_special_requests: accommodation_special_requests,
      });
  

      res.json(booking);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error });
    }
  };