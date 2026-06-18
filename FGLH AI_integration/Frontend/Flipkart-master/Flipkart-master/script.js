// Chat Toggle Logic
const chatBtn = document.getElementById('ai-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatWindow = document.getElementById('ai-chat-window');

if (chatBtn && closeChatBtn && chatWindow) {
    chatBtn.addEventListener('click', () => {
        chatWindow.classList.remove('scale-0', 'opacity-0');
        chatWindow.classList.add('scale-100', 'opacity-100');
    });
    closeChatBtn.addEventListener('click', () => {
        chatWindow.classList.remove('scale-100', 'opacity-100');
        chatWindow.classList.add('scale-0', 'opacity-0');
    });
}

// Simple Interaction logic for demo
document.querySelectorAll('.aegis-card').forEach(card => {
    card.addEventListener('click', () => {
        console.log('Feature detail requested');
    });
});

// Prediction form logic
const predictBtn = document.getElementById('predict-btn');
if (predictBtn) {
    predictBtn.addEventListener('click', () => {
        const placeholder = document.getElementById('prediction-placeholder');
        const results = document.getElementById('prediction-results');
        const loading = document.getElementById('prediction-loading');

        // 1. Gather all form inputs
        const eventType = document.getElementById('event-type') ? document.getElementById('event-type').value : 'planned';
        const cause = document.getElementById('event-cause') ? document.getElementById('event-cause').value : 'others';
        const zone = document.getElementById('event-zone') ? document.getElementById('event-zone').value : '';
        const junction = document.getElementById('event-junction') ? document.getElementById('event-junction').value : '';
        const dateVal = document.getElementById('event-date') ? document.getElementById('event-date').value : '';
        const timeVal = document.getElementById('event-time') ? document.getElementById('event-time').value : '';
        const closureNode = document.querySelector('input[name="road_closure"]:checked');
        const closure = closureNode ? closureNode.value : 'no';
        const crowdSize = parseInt(document.getElementById('event-crowd') ? document.getElementById('event-crowd').value : '0') || 0;
        const duration = parseFloat(document.getElementById('event-duration') ? document.getElementById('event-duration').value : '0') || 0;
        const locationDesc = document.getElementById('event-location') ? document.getElementById('event-location').value : '';
        const corridor = document.getElementById('corridor') ? document.getElementById('corridor').value : 'Non-corridor';

        // 2. Calculate derived variables from date/time
        let hour = new Date().getHours();
        let day_of_week = new Date().getDay();
        let month = new Date().getMonth() + 1;
        let is_peak_hour = false;
        let is_weekend = false;

        if (dateVal && timeVal) {
            const dt = new Date(`${dateVal}T${timeVal}`);
            if (!isNaN(dt.getTime())) {
                hour = dt.getHours();
                day_of_week = dt.getDay();
                month = dt.getMonth() + 1;
            }
        } else if (timeVal) {
            const [h] = timeVal.split(':').map(Number);
            if (!isNaN(h)) hour = h;
        }

        is_weekend = (day_of_week === 0 || day_of_week === 6);
        is_peak_hour = ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20));

        // Store for future Flask API integration
        window.predictionPayload = {
            event_type: eventType, cause, zone, junction,
            hour, day_of_week, month, is_peak_hour, is_weekend,
            road_closure: closure, crowd_size: crowdSize,
            duration_hours: duration, location_description: locationDesc,
            corridor: corridor
        };
        console.log("Prediction Payload (for API):", window.predictionPayload);

        // 3. Show loading state
        if (placeholder) placeholder.classList.add('hidden');
        if (results) results.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');

        // Disable button during loading
        predictBtn.disabled = true;
        predictBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span> Analyzing...';
        predictBtn.classList.add('opacity-70', 'cursor-not-allowed');

        // 4. Send POST request to Flask API
        fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.predictionPayload)
        })
        .then(response => {
            if (!response.ok) throw new Error(`Server responded with status ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log("API Response:", data);

            const prediction = data.prediction || {};
            const recommendation = data.recommendation || {};

            // Use prediction.priority directly as the display label
            const riskLevel = prediction.priority || 'Low';

            // Derive styling from risk_score (the actual model output)
            const score = prediction.risk_score || 0;
            let bannerClass, iconName, riskDotColor;

            if (score >= 75) {
                bannerClass = "bg-error-container text-on-error-container border-error/30";
                iconName = "emergency";
                riskDotColor = "bg-red-500";
            } else if (score >= 50) {
                bannerClass = "bg-error-container text-on-error-container border-error/30";
                iconName = "warning";
                riskDotColor = "bg-orange-500";
            } else if (score >= 25) {
                bannerClass = "bg-tertiary-container text-on-tertiary-container border-tertiary/30";
                iconName = "traffic";
                riskDotColor = "bg-yellow-400";
            } else {
                bannerClass = "bg-secondary-container text-on-secondary-container border-outline-variant";
                iconName = "check_circle";
                riskDotColor = "bg-green-500";
            }

            // Use risk_score directly as percentage
            const riskScore = prediction.risk_score || 0;
            const confidence = Math.round(riskScore);

            // Hide loading
            if (loading) loading.classList.add('hidden');

            // Update all output elements
            const el = (id) => document.getElementById(id);
            if (el('risk-level-text')) el('risk-level-text').textContent = riskLevel;
            if (el('congestion-level-text')) el('congestion-level-text').textContent = prediction.congestion_level || 'N/A';
            if (el('delay-text')) el('delay-text').textContent = (prediction.expected_delay_minutes || 0) + ' min';
            if (el('radius-text')) el('radius-text').textContent = (prediction.affected_radius_km || 0) + ' km';
            if (el('police-count')) el('police-count').textContent = recommendation.police_officers || 0;
            if (el('barricade-count')) el('barricade-count').textContent = recommendation.barricades || 0;
            if (el('ambulance-count')) el('ambulance-count').textContent = recommendation.ambulances || 0;
            if (el('marshal-count')) el('marshal-count').textContent = recommendation.traffic_marshals || 0;
            if (el('diversion-route-text')) el('diversion-route-text').textContent = recommendation.diversion_route || 'No Diversion Needed';

            // Update confidence displays
            if (el('confidence-text')) el('confidence-text').textContent = confidence + '%';
            if (el('confidence-bar')) el('confidence-bar').style.width = confidence + '%';
            if (el('confidence-badge')) el('confidence-badge').textContent = 'AI Confidence: ' + confidence + '%';

            // Update risk dot color
            const riskDot = el('risk-dot');
            if (riskDot) {
                riskDot.className = `inline-block w-3 h-3 rounded-full ${riskDotColor}`;
            }

            // Update risk banner styling
            const banner = el('risk-banner');
            if (banner) banner.className = `p-lg rounded-xl mb-md flex items-center gap-md border shadow-sm ${bannerClass}`;
            const riskIcon = el('risk-icon');
            if (riskIcon) riskIcon.textContent = iconName;

            // Show results with animation
            if (results) {
                results.classList.remove('hidden');
                results.style.animation = 'none';
                results.offsetHeight; // Trigger reflow
                results.style.animation = 'fadeSlideIn 0.5s ease-out';
            }

            // Reset button
            predictBtn.disabled = false;
            predictBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">refresh</span> Update Prediction';
            predictBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        })
        .catch(error => {
            console.error("Prediction API Error:", error);

            // Hide loading, show placeholder
            if (loading) loading.classList.add('hidden');
            if (placeholder) placeholder.classList.remove('hidden');
            if (results) results.classList.add('hidden');

            // Show error banner
            const errorBanner = document.createElement('div');
            errorBanner.className = 'bg-error-container text-on-error-container p-md rounded-xl mb-md flex items-center gap-md border border-error/20 shadow-sm';
            errorBanner.id = 'prediction-error';
            errorBanner.innerHTML = `
                <span class="material-symbols-outlined text-[24px]">error</span>
                <div class="flex-grow">
                    <div class="font-label-md text-label-md font-bold">Prediction Failed</div>
                    <div class="text-[12px] opacity-80">${error.message}. Ensure Flask server is running at http://127.0.0.1:5000</div>
                </div>
                <button onclick="this.parentElement.remove()" class="text-[20px] opacity-60 hover:opacity-100 cursor-pointer">&times;</button>
            `;
            // Remove any previous error
            const prevError = document.getElementById('prediction-error');
            if (prevError) prevError.remove();
            // Insert before placeholder
            const predSection = placeholder ? placeholder.parentElement : document.getElementById('prediction-section');
            if (predSection && placeholder) {
                predSection.insertBefore(errorBanner, placeholder);
            }

            // Reset button
            predictBtn.disabled = false;
            predictBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">refresh</span> Update Prediction';
            predictBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        });
    });
}

// Toggle active navigation
const navLinks = document.querySelectorAll('nav a');
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        navLinks.forEach(l => {
            l.classList.remove('text-primary', 'font-bold', 'border-b-2', 'border-primary');
            l.classList.add('text-on-surface-variant');
        });
        link.classList.remove('text-on-surface-variant');
        link.classList.add('text-primary', 'font-bold', 'border-b-2', 'border-primary');
    });
});
