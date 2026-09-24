# Patlolla Chandrashekar Reddy — Website

A static, mobile-friendly website for **Patlolla Chandrashekar Reddy, President, District Congress Committee (DCC), Sangareddy**. It's plain HTML, CSS and JavaScript, so there's no build step. Open `index.html` in a browser or host the folder anywhere (Netlify, GitHub Pages, Vercel).

## Sections
1. **Protocol strip** (top, auto-scrolling): Kharge, Sonia Gandhi, Rahul Gandhi, AICC Telangana in-charge, CM Revanth Reddy, Deputy CM, TPCC President Mahesh Kumar Goud, district minister, MLA Sanjeeva Reddy, late Kishta Reddy
2. Hero with name (English + Telugu) and role
3. About
4. Family legacy: late father Patlolla Kishta Reddy and brother Patlolla Sanjeeva Reddy
5. Social service activities
6. Photo gallery with filters and a lightbox
7. Videos (local MP4 or YouTube)
8. Instagram embeds
9. Contact form that opens WhatsApp

## Adding photos
Save photos with these exact names. Until a photo is added, the site shows a tricolour initials badge in its place.

| File | Who / what |
|---|---|
| `images/hero.jpg` | Main portrait (square, face near the top) |
| `images/about.jpg` | Photo with people (portrait 4:5) |
| `images/leaders/kharge.jpg` | Mallikarjun Kharge |
| `images/leaders/sonia-gandhi.jpg` | Sonia Gandhi |
| `images/leaders/rahul-gandhi.jpg` | Rahul Gandhi |
| `images/leaders/meenakshi-natarajan.jpg` | Meenakshi Natarajan |
| `images/leaders/revanth-reddy.jpg` | A. Revanth Reddy |
| `images/leaders/bhatti-vikramarka.jpg` | Mallu Bhatti Vikramarka |
| `images/leaders/mahesh-kumar-goud.jpg` | B. Mahesh Kumar Goud |
| `images/leaders/damodar-raja-narasimha.jpg` | Damodar Raja Narasimha |
| `images/family/kishta-reddy.jpg` | Late Patlolla Kishta Reddy |
| `images/family/sanjeeva-reddy.jpg` | Patlolla Sanjeeva Reddy |
| `images/gallery/01.jpg` … `09.jpg` | Gallery photos (captions are in `script.js`) |
| `videos/01.mp4`, `videos/02.mp4` | Videos |

Leader photos look best when square, with the face centred.

## Editing content
All text and lists are at the top of **`script.js`**:
- `protocolLeaders`: add, remove or reorder leaders in the top strip
- `family`, `services`, `stats`: section content
- `gallery`: add photos and captions (`tag` sets the filter button)
- `videos`: `{ file: "videos/x.mp4" }` or `{ youtube: "VIDEO_ID" }`
- `instagramPosts`: paste Instagram post or reel URLs to embed them
- `WHATSAPP_NUMBER` and `contacts`: office phone and address

### Getting media from Instagram
Open each post on [@patlolla_chandrashekar_reddy](https://www.instagram.com/patlolla_chandrashekar_reddy/), then either:
- copy the post URL into `instagramPosts` (it embeds live, and videos play), or
- save the photo or video and put it in `images/gallery/` or `videos/`.

## Deploying
Drag this folder onto https://app.netlify.com/drop, or point a Netlify, Vercel or GitHub Pages site at this folder. No build command is needed.
