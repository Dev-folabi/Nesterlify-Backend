import Amadeus from "amadeus";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export const amadeus = new Amadeus({
  clientId: process.env.AMADEUS_CLIENT_ID || "",
  clientSecret: process.env.AMADEUS_CLIENT_SECRET || "",
});

// async function checkAuth() {
//   try {
//     const response = await amadeus.client.get('/v1/security/oauth2/token');
//     console.log('Auth Successful:', response.data);
//   } catch (error) {
//     console.error('Auth Error:', error);
//   }
// }

// checkAuth();

const AMADEUS_TOKEN_URL = process.env.AMADEUS_TOKEN_URL || "";

export const getAmadeusToken = async () => {
  try {
    const response = await axios.post(
      AMADEUS_TOKEN_URL,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AMADEUS_CLIENT_ID || "",
        client_secret: process.env.AMADEUS_CLIENT_SECRET || "",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (error: any) {
    console.error(
      "Error fetching access token:",
      error.response?.data || error.message
    );
  }
};
