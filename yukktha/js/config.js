// Yukktha storefront settings.
//
// Catalogue: the site reads the live saree list from the same Firestore
// project the BrightLoop admin writes to (projects/yukktha/sarees), so a saree
// added in the admin shows up here without a redeploy. If Firestore can't be
// reached, it falls back to the snapshot in data/sarees.json.
//
// The Firebase web API key below is a public client identifier (it ships in
// every Firebase web app); access is controlled by Firestore security rules.
window.YUKKTHA_CONFIG = {
  brand: 'Yukktha',
  tagline: 'Timeless Royal Weaves',
  phone: '8341448340',
  phoneIntl: '+918341448340',
  whatsapp: '918341448340',
  instagram: 'yukkthasareestuddio',
  hours: 'Mon – Sun · 10:00 AM – 8:30 PM',
  stores: [
    {
      label: 'New Nallakunta',
      address: '2-2, 1159/111, Brahmin Hostel Ln, Prashanti Nagar, Tilak Nagar, New Nallakunta, Hyderabad, Telangana 500044',
      mapsQuery: '2-2, 1159/111 Brahmin Hostel Ln Prashanti Nagar Tilak Nagar New Nallakunta Hyderabad Telangana 500044'
    },
    {
      label: 'Jubilee Hills',
      address: 'Jubilee Hills, Hyderabad, Telangana',
      mapsQuery: 'Yukktha Sarees Jubilee Hills Hyderabad Telangana'
    }
  ],
  firebase: {
    apiKey: 'AIzaSyCWGe8E6CoE9D2lIzt2DaajSGK05oTtebg',
    authDomain: 'yukk-1cf77.firebaseapp.com',
    projectId: 'yukk-1cf77',
    storageBucket: 'yukk-1cf77.firebasestorage.app',
    messagingSenderId: '902075156235',
    appId: '1:902075156235:web:3e7401868a2ad30da7c40e',
    projectSlug: 'yukktha'
  },
  // Set to false to always use data/sarees.json (no network call to Firestore).
  liveCatalogue: true,
  // Online checkout: Netlify forwards /api/* to the BrightLoop order and payment
  // functions (see netlify.toml), which hold the Razorpay keys and write the
  // order into Firestore, where the admin manages it.
  checkoutApi: 'api/',
  firebaseSdk: 'https://www.gstatic.com/firebasejs/10.12.2/'
};
