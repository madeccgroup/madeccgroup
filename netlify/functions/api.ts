import serverless from 'serverless-http';
import { getApp } from '../../server.ts';

let cachedHandler: any;

export const handler = async (event: any, context: any) => {
  if (!cachedHandler) {
    const app = await getApp();
    cachedHandler = serverless(app);
  }
  // Netlify serverless environments don't persist filesystem changes between invocations.
  // We make sure process.env.NETLIFY is set so the server knows it is running in serverless.
  process.env.NETLIFY = 'true';
  return cachedHandler(event, context);
};
