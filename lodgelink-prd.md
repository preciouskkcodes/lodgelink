# LodgeLink — Product Requirements Document v1.0

**Frontend**
LodgeLink should be built using React Native, which compiles a single codebase into native apps for both Android and iOS, eliminating the cost of maintaining two separate applications — critical given the limited budget. React Native was chosen over Flutter because of its larger developer community, greater availability of Nigerian developers familiar with the stack, and strong support for low-end Android devices running Android 8.0 and above. A browser version using React web can be derived from the same codebase with minimal additional effort. In production at scale, the app would be distributed through the Google Play Store and Apple App Store with a Progressive Web App for browser access and offline browsing capability for slow networks. The key trade-off is that React Native performance on very low-end devices can degrade with heavy image loading — resolved in production through aggressive image lazy-loading and pagination of listing results.

**Backend**
Supabase is the recommended backend — it combines a PostgreSQL database, auto-generated RESTful API, real-time subscriptions, and authentication into a single managed platform, replacing what would otherwise require a dedicated backend developer to configure and maintain separately. It handles the two core backend jobs LodgeLink needs: managing listing approvals through an admin review queue before any listing goes live, and updating room availability in real time the moment a reservation is submitted. In production, as transaction volume grows across multiple program cycles, the backend would migrate toward dedicated microservices — separating the listings, reservations, and notifications services — each independently scalable during surge periods. The trade-off is Supabase's free tier rate limits, which would bottleneck performance during peak program demand and require upgrading to a paid plan before the first high-attendance event.

**Data Layer**
PostgreSQL via Supabase is the recommended database. The data model must be event-driven — every listing and availability slot is anchored to a specific program date so attendees only ever see accommodation relevant to the program they are attending, preventing stale or misleading inventory. Room photos are stored and served via Cloudinary, which automatically compresses images for fast delivery on 3G networks. User accounts are authenticated by phone number OTP only — no email or password — reducing friction for the target user who may not have reliable email access. In production, the database would be indexed on program date, price, and location coordinates to maintain fast search response times as listing volume grows. The trade-off is that a single Supabase project managing all data is clean at MVP scale but will require partitioned storage and a dedicated database strategy once the platform expands beyond the initial program cycle.

**AI Layer**
The Claude API is recommended to power three specific functions: a natural language search bar where attendees describe their needs conversationally and receive ranked results without navigating filters; a no-match intelligence layer that presents clearly labelled alternatives when no exact result exists rather than returning an empty screen; and a program alert engine that notifies users early when new program dates are announced so they can reserve before peak demand. All API calls must be made server-side only — never from the mobile app directly — to protect the API key and enable response caching. In production, as listing volume grows, a vector search or RAG implementation would replace direct prompt-based search to maintain speed and reduce API costs. The trade-off is API cost at high query volume, managed through server-side caching of common search patterns.

**External Integrations**
Four external services are essential. Google Maps Distance Matrix API calculates and stores the distance from each listed property to the main auditorium once at the point of listing creation — avoiding repeated real-time API calls on every search. Cloudinary handles all room photo storage and automatic compression, keeping image delivery fast on slow networks without manual optimisation by hosts. Termii, a Nigerian-built SMS gateway, handles all reservation confirmations, host approval alerts, and program announcements with delivery rates significantly more reliable than international alternatives across Nigerian networks. Paystack is recommended for on-platform payments when the transaction model is finalised — it is the Nigerian market standard, supports split payments for commission deduction, and requires only a CAC-registered business account to onboard. In production, these integrations would be abstracted behind an internal service layer so any single provider can be swapped without rebuilding the core application. The trade-off is dependency on third-party uptime — particularly Termii for SMS delivery during peak program periods — mitigated by building a fallback notification channel through Firebase Cloud Messaging for push notifications.


<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Lodgelink — Safe, faith-filled lodging for church members attending programs at Asese and RCCG Camp." />
    <title>Lodgelink — Brethren Hospitality</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
    
    <style>
        :root {
            --cl-brand: #E05C2A;           /* Warm terracotta */
            --cl-brand-dark: #C44A1F;
            --cl-brand-light: #FFF4ED;
            --cl-surface: #FFF8F0;         /* Sharp warm cream */
            --cl-card: #FFFFFF;
            --cl-ink: #2C2119;
            --cl-ink-muted: #6B5A4E;
            --cl-border: #EFD9C7;
            --radius-sm: 8px;
            --radius-md: 16px;
            --radius-lg: 24px;
            --radius-pill: 100px;
            --shadow-card: 0 6px 20px rgba(224,92,42,.12);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'DM Sans', sans-serif;
            background: var(--cl-surface);
            color: var(--cl-ink);
            line-height: 1.6;
            font-size: 16px;
        }

        .container { width: 100%; max-width: 420px; margin: 0 auto; padding: 0 20px; }

        #btn-primary, .btn-primary {
            background: var(--cl-brand);
            color: white;
            border: none;
            border-radius: var(--radius-pill);
            font-weight: 700;
            padding: 16px 28px;
            width: 100%;
            min-height: 56px;
            font-size: 1.05rem;
            cursor: pointer;
            box-shadow: 0 5px 16px rgba(224,92,42,.35);
            transition: all 0.25s ease;
        }
        #btn-primary:active { transform: scale(0.97); }

        input, select {
            width: 100%;
            padding: 14px 16px;
            border: 1.5px solid var(--cl-border);
            border-radius: var(--radius-sm);
            font-size: 0.97rem;
            min-height: 52px;
            background: white;
        }
        input:focus, select:focus {
            outline: none;
            border-color: var(--cl-brand);
            box-shadow: 0 0 0 4px rgba(224,92,42,.15);
        }

        #hero {
            background: linear-gradient(135deg, #FFF4ED 0%, #FEF0E6 100%);
            padding-top: 24px;
            padding-bottom: 48px;
            text-align: center;
        }
        .hero-heading {
            font-size: 2.25rem;
            font-weight: 800;
            line-height: 1.12;
            margin-bottom: 12px;
            color: #2C2119;
        }
        .hero-sub { 
            color: var(--cl-ink-muted); 
            margin-bottom: 32px;
            font-size: 1.02rem;
            line-height: 1.55;
            max-width: 34ch;
            margin-left: auto;
            margin-right: auto;
        }

        .welcome-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #FFF4ED;
            color: var(--cl-brand);
            padding: 6px 16px;
            border-radius: 30px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>

    <!-- HERO SECTION -->
    <header id="hero">
        <div class="container">
            <nav style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <div style="font-size:1.5rem; font-weight:800; color:var(--cl-brand);">Lodge<span style="color:#C44A1F">Link</span></div>
                <a href="#" style="color:var(--cl-brand); font-weight:600; font-size:0.95rem;">Log in</a>
            </nav>

            <div class="welcome-badge">
                🙏 Welcome, Brethren
            </div>

            <h1 class="hero-heading">Accommodation made easy.</h1>
            <p class="hero-sub">Stay with the brethren at Asese and RCCG Camp — safe, comfortable and peaceful accommodation.</p>

            <div style="background:white; padding:28px 24px; border-radius:24px; box-shadow:0 8px 28px rgba(224,92,42,.1);">
                <div style="margin-bottom:18px;">
                    <label for="input-location" style="display:block; margin-bottom:6px; font-weight:600; color:#2C2119;">Program Location</label>
                    <select id="input-location">
                        <option value="">Select area</option>
                        <option value="asese">Asese</option>
                        <option value="rccg-camp">RCCG Camp (Km 46)</option>
                        <option value="redemption-city">Redemption City</option>
                    </select>
                </div>
                
                <div style="margin-bottom:24px;">
                    <label for="input-date" style="display:block; margin-bottom:6px; font-weight:600; color:#2C2119;">Arrival Date</label>
                    <input type="date" id="input-date" />
                </div>

                <button id="btn-primary">Find Comfortable Lodging</button>
            </div>
        </div>
    </header>

    <!-- MAIN SECTION -->
    <main id="main">
        <div class="container">
            <p style="font-weight:700; color:var(--cl-brand); margin:32px 0 8px; text-align:center;">🌿 34 BRETHREN HOSTS READY TO WELCOME YOU</p>
            <h2 style="font-size:1.55rem; margin-bottom:8px; text-align:center;">Available Homes Near Asese &amp; RCCG Camp</h2>
            <p style="color:var(--cl-ink-muted); margin-bottom:24px; text-align:center;">Verified by fellow church members</p>

            <div id="list-root"></div>

            <div id="insights-panel" style="background:#FFF4ED; border-radius:20px; padding:24px; margin:32px 0;">
                <h3 style="margin-bottom:14px; color:var(--cl-brand); font-size:1.2rem;">🙏 A Word from Lodgelink</h3>
                <ul style="list-style:none; padding:0; color:#444; line-height:1.6;">
                    <li style="margin-bottom:12px;">• Over 28 homes open this week for programs</li>
                    <li style="margin-bottom:12px;">• Many hosts preparing special meals for brethren</li>
                    <li>• All homes welcome morning devotion and fellowship</li>
                </ul>
            </div>
        </div>
    </main>

    <!-- FOOTER -->
    <footer style="background:#2C2119; color:white; padding:48px 20px 32px; text-align:center;">
        <div class="container">
            <p style="font-size:1.45rem; font-weight:800;">Lodge<span style="color:#FF9F6B">Link</span></p>
            <p style="margin:12px 0 28px; opacity:0.9;">Connecting the Body of Christ through warm hospitality</p>
            
            <div style="font-size:0.82rem; opacity:0.75;">
                © 2025 Lodgelink — Built for the Brethren
            </div>
        </div>
    </footer>

    <script src="app.js"></script>
    <script>
        const listings = [
            {
                host: "Sis. Comfort Adebayo",
                church: "RCCG",
                location: "Asese, Ogun State",
                stay: "2 spacious rooms • Private entrance",
                price: "Free (Love offering)",
                note: "Warm Christian family, loves hosting brethren"
            },
            {
                host: "Bro. Michael Okafor",
                church: "RCCG",
                location: "Very close to RCCG Camp",
                stay: "Self-contained studio",
                price: "₦4,000/night",
                note: "Quiet, peaceful environment for prayer"
            },
            {
                host: "Deaconess Funke Alabi",
                church: "RCCG",
                location: "Asese",
                stay: "3 comfortable beds • Shared kitchen",
                price: "Free",
                note: "Early morning devotion daily"
            }
        ];

        function renderListings() {
            const root = document.getElementById('list-root');
            root.innerHTML = '';
            
            listings.forEach((listing, index) => {
                const card = document.createElement('div');
                card.style = `
                    background: white; 
                    border-radius: 20px; 
                    overflow: hidden; 
                    box-shadow: var(--shadow-card); 
                    margin-bottom: 20px;
                `;
                card.innerHTML = `
                    <div style="height: 170px; background: linear-gradient(#FFF4ED, #FFE8D6); display:flex; align-items:center; justify-content:center; font-size:4rem;">
                        🙏
                    </div>
                    <div style="padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                            <div>
                                <strong style="font-size:1.1rem;">${listing.host}</strong><br>
                                <small style="color:var(--cl-brand); font-weight:600;">${listing.church}</small>
                            </div>
                            <span style="background:#FFE8D6; color:var(--cl-brand); padding:4px 12px; border-radius:20px; font-size:0.78rem;">Verified</span>
                        </div>
                        <p style="font-weight:600; margin:8px 0;">${listing.location}</p>
                        <p style="color:#444; margin-bottom:8px;">${listing.stay}</p>
                        <p style="color:var(--cl-brand); font-weight:700; font-size:1.1rem;">${listing.price}</p>
                        <small style="color:#555; display:block; margin:12px 0;">${listing.note}</small>
                        <button onclick="requestStay(${index})" style="background:var(--cl-brand); color:white; border:none; padding:14px; border-radius:30px; width:100%; font-weight:600;">Request to Stay</button>
                    </div>
                `;
                root.appendChild(card);
            });
        }

        function requestStay(index) {
            alert("✅ Request sent successfully!\n\nA brother or sister will contact you shortly.\nGod bless you richly.");
        }

        window.onload = renderListings;
    </script>
</body>
</html>
