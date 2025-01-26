// Function to get or create a client ID for Google Analytics
function getOrCreateClientId() {
    let clientId = customSettings.getConfigValue('clientId');
    if (!clientId) {
        // Generate a unique client ID, the actual value is not relevant
        clientId = self.crypto.randomUUID();
        customSettings.setConfigValue('clientId', clientId);
    }
    return clientId;
}

// Function to initialize Google Analytics
const initializeGoogleAnalytics = () => {
    const scriptTag = document.createElement('script');
    scriptTag.async = true;
    scriptTag.src = 'https://www.googletagmanager.com/gtag/js?id=G-0356XB31M8';
    document.head.appendChild(scriptTag);

    window.dataLayer = window.dataLayer || [];
    const gtag = (...args) => dataLayer.push(args);
    gtag('js', new Date());
    gtag('config', 'G-0356XB31M8');
};


function sendEventToGoogleAnalytics(event) {
    const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
    const MEASUREMENT_ID = "G-0356XB31M8";
    const API_SECRET = "ZuFTmTvMQX2H6H121ZyY2A";

    fetch(
        `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
        {
            method: 'POST',
            body: JSON.stringify({
                client_id: getOrCreateClientId(),
                events: [
                    {
                        name: event.name,
                        params: event.params,
                    },
                ],
            }),
        }
    );  
}

// Export the functions to be used in the main script
window.helpersGanalytics = {
    getOrCreateClientId: getOrCreateClientId,
    initializeGoogleAnalytics: initializeGoogleAnalytics,
    sendEventToGoogleAnalytics: sendEventToGoogleAnalytics
}

