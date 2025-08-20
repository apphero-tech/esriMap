import { LightningElement, api } from 'lwc';

export default class EsriMap extends LightningElement {
    @api champRelation;
    @api idParent;
    
    isMapInitialized = false;
    
    // Coordonnées du dernier clic pour géocodage
    coordinates = { latitude: 0, longitude: 0 };
    
    // URL de la page Visualforce avec ArcGIS
    get vfPageUrl() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/apex/ArcGISMap`;
    }
    
    renderedCallback() {
        if (this.isMapInitialized) {
            return;
        }
        this.isMapInitialized = true;
        this.initializeIframe();
    }

    initializeIframe() {
        const container = this.template.querySelector('.map-container');
        if (!container) {
            return;
        }
        
        // Créer l'iframe pour la page Visualforce
        const iframe = document.createElement('iframe');
        iframe.src = this.vfPageUrl;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '4px';
        
        // Ajouter l'iframe au conteneur
        container.appendChild(iframe);
        
        // Écouter les messages de l'iframe
        const boundHandler = this.handleIframeMessage.bind(this);
        window.addEventListener('message', boundHandler);
    }
    
    handleIframeMessage(event) {
        // Vérification d'origine pour Salesforce
        const isValidOrigin = event.origin.includes(window.location.hostname) || 
                             event.origin.includes('.salesforce.com') ||
                             event.origin.includes('.force.com') ||
                             event.origin === window.location.origin;
        
        if (!isValidOrigin) {
            return;
        }
        
        switch (event.data.type) {
            case 'MAP_READY':
                this.onMapReady();
                break;
                
            case 'MAP_CLICK':
                this.onMapClick(event.data.coordinates);
                break;
        }
    }
    
    onMapReady() {
        // Carte ArcGIS opérationnelle
    }
    
    onMapClick(coordinates) {
        // Mettre à jour les coordonnées
        this.coordinates = coordinates;
        
        // Envoyer les coordonnées à la page Visualforce pour géocodage
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'GEOCODE_REQUEST',
                coordinates: coordinates
            }, '*');
        }
    }
    
    // Méthode pour centrer la carte depuis le LWC
    centerMap(longitude, latitude, zoom = 12) {
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'CENTER_MAP',
                longitude: longitude,
                latitude: latitude,
                zoom: zoom
            }, '*');
        }
    }
}