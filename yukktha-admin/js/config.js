// Yukktha admin settings.
// The admin works on the same Firebase project as the storefront and the
// BrightLoop admin (projects/<projectSlug>/...), so every change shows up on
// the website straight away.
export const CONFIG = {
  projectSlug: 'yukktha',
  storefrontUrl: 'https://yukktha-sarees.netlify.app/',
  firebase: {
    apiKey: 'AIzaSyCWGe8E6CoE9D2lIzt2DaajSGK05oTtebg',
    authDomain: 'yukk-1cf77.firebaseapp.com',
    projectId: 'yukk-1cf77',
    storageBucket: 'yukk-1cf77.firebasestorage.app',
    messagingSenderId: '902075156235',
    appId: '1:902075156235:web:3e7401868a2ad30da7c40e'
  },
  firebaseSdk: 'https://www.gstatic.com/firebasejs/10.12.2/',
  // Order statuses, matching the BrightLoop admin and storefront checkout.
  orderStatuses: ['pending_payment', 'paid', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'returned'],
  unwoundStatuses: ['cancelled', 'returned'],
  lowStockAt: 2
};
