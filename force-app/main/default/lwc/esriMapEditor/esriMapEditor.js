import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

// Import des méthodes Apex
import getArcGISConfig from '@salesforce/apex/ArcGISConfigController.getPublicConfig';
import saveMapAreas from '@salesforce/apex/MapAreaService.saveMapAreas';

export default class EsriMapEditor extends NavigationMixin(LightningElement) {
    // Propriétés publiques configurables
    @api recordId;
    @api basemap;
    @api geocoderUrl;
    @api height = '420px';
    @api fitToParent = false;
    @api locale;
    
    // État interne
    @track isLoading = true;
    @track isMapReady = false;
    @track errorMessage = '';
    @track selectedGeometry = null;
    @track selectedAddress = '';
    @track mapCenter = { lat: 45.5017, lng: -73.5673 }; // Montréal par défaut
    @track zoomLevel = 10;
    
    // Configuration ArcGIS
    arcGISConfig = null;
    
    // Variables iframe
    iframeLoaded = false;
    iframeWindow = null;
    
    // Propriétés calculées
    get isMapReadyNot() {
        return !this.isMapReady;
    }
    
    get mapContainerStyle() {
        return `height: ${this.height}; width: 100%;`;
    }
    
    get iframeUrl() {
        return '/apex/ArcGISMap';
    }
    
    // Cycle de vie du composant
    async connectedCallback() {
        try {
            console.log('🚀 esriMapEditor connecté, début initialisation ArcGIS...');
            await this.initializeComponent();
        } catch (error) {
            console.error('❌ Erreur initialisation composant:', error);
            this.errorMessage = 'Erreur lors de l\'initialisation du composant ArcGIS';
            this.isLoading = false;
        }
    }
    
    // Initialisation du composant
    async initializeComponent() {
        try {
            // Charger la configuration ArcGIS
            await this.loadArcGISConfig();
            
            // Marquer comme terminé
            this.isLoading = false;
            console.log('✅ Composant ArcGIS initialisé avec succès');
            
        } catch (error) {
            console.error('❌ Erreur initialisation:', error);
            this.errorMessage = 'Impossible d\'initialiser la carte ArcGIS';
            this.isLoading = false;
        }
    }
    
    // Charger la configuration ArcGIS
    async loadArcGISConfig() {
        try {
            this.arcGISConfig = await getArcGISConfig();
            console.log('✅ Configuration ArcGIS chargée:', this.arcGISConfig);
        } catch (error) {
            console.error('❌ Erreur chargement configuration:', error);
            throw new Error('Impossible de charger la configuration ArcGIS');
        }
    }
    
    // Gestion des événements iframe
    renderedCallback() {
        const iframe = this.template.querySelector('iframe');
        if (iframe && !this.iframeLoaded) {
            iframe.addEventListener('load', () => {
                this.iframeLoaded = true;
                this.iframeWindow = iframe.contentWindow;
                this.initializeIframeIfReady();
            });
        }
        
        // Écouter les messages de l'iframe
        window.addEventListener('message', this.handleIframeMessage.bind(this));
    }
    
    disconnectedCallback() {
        window.removeEventListener('message', this.handleIframeMessage.bind(this));
    }
    
    // Initialiser l'iframe si prête
    initializeIframeIfReady() {
        if (this.iframeLoaded && this.iframeWindow && this.arcGISConfig) {
            this.sendMessageToIframe({
                type: 'INIT_MAP',
                config: {
                    apiKey: this.arcGISConfig.apiKey,
                    basemap: this.basemap || this.arcGISConfig.defaultBasemap || 'arcgis-navigation',
                    geocoderUrl: this.geocoderUrl || this.arcGISConfig.geocoderUrl,
                    height: this.height,
                    locale: this.locale || this.arcGISConfig.locale || 'fr-CA',
                    center: this.mapCenter,
                    zoom: this.zoomLevel
                }
            });
            
            this.isMapReady = true;
            console.log('✅ Iframe ArcGIS initialisée avec succès');
        }
    }
    
    // Envoyer un message à l'iframe
    sendMessageToIframe(message) {
        if (this.iframeWindow) {
            this.iframeWindow.postMessage(message, '*');
            console.log('📤 Message envoyé à iframe:', message);
        }
    }
    
    // Gérer les messages de l'iframe
    handleIframeMessage(event) {
        try {
            const { type, data } = event.data;
            console.log('📥 Message reçu de iframe:', { type, data });
            
            switch (type) {
                case 'MAP_READY':
                    this.isMapReady = true;
                    console.log('✅ Carte ArcGIS prête');
                    break;
                    
                case 'SHAPE_SELECTED':
                    this.selectedGeometry = data.shape;
                    this.selectedAddress = data.shape.address || '';
                    console.log('✅ Forme sélectionnée:', this.selectedGeometry);
                    this.showToast('Forme sélectionnée', `Type: ${data.shape.type}`, 'success');
                    break;
                    
                case 'ADDRESS_SELECTED':
                    this.selectedGeometry = data.address;
                    this.selectedAddress = data.address.address || '';
                    console.log('✅ Adresse sélectionnée:', this.selectedAddress);
                    this.showToast('Adresse sélectionnée', this.selectedAddress, 'success');
                    break;
                    
                case 'SHAPE_DATA':
                    this.handleShapeData(data.shapeData);
                    break;
                    
                case 'NO_SHAPE_SELECTED':
                    this.selectedGeometry = null;
                    this.selectedAddress = '';
                    console.log('✅ Aucune forme sélectionnée');
                    break;
                    
                case 'ERROR':
                    console.error('❌ Erreur iframe:', data.error);
                    this.errorMessage = data.error;
                    break;
                    
                default:
                    console.log('📥 Message non géré:', type);
            }
            
        } catch (error) {
            console.error('❌ Erreur traitement message iframe:', error);
        }
    }
    
    // Gérer les données de forme
    handleShapeData(shapeData) {
        try {
            console.log('📊 Données de forme reçues:', shapeData);
            
            // Préparer les données pour la sauvegarde
            const mapAreaData = {
                Area_Type__c: shapeData.areaType,
                Geometry_JSON__c: shapeData.geoJson,
                Latitude__c: shapeData.latitude,
                Longitude__c: shapeData.longitude,
                Address__c: shapeData.address || ''
            };
            
            // Sauvegarder automatiquement
            this.saveMapAreaData(mapAreaData);
            
        } catch (error) {
            console.error('❌ Erreur traitement données de forme:', error);
            this.showToast('Erreur', 'Erreur lors du traitement des données', 'error');
        }
    }
    
    // Sauvegarder les données de zone de carte
    async saveMapAreaData(mapAreaData) {
        try {
            const result = await saveMapAreas({ mapAreasJson: JSON.stringify([mapAreaData]) });
            
            if (result && result.length > 0) {
                this.showToast('Succès', 'Zone de carte ArcGIS sauvegardée', 'success');
                console.log('✅ Zone ArcGIS sauvegardée:', result[0]);
            }
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde:', error);
            this.showToast('Erreur', 'Impossible de sauvegarder la zone', 'error');
        }
    }
    
    // Sauvegarder la zone de la carte
    async handleSaveMapArea() {
        if (!this.selectedGeometry) {
            this.showToast('Erreur', 'Aucune zone sélectionnée', 'error');
            return;
        }
        
        // Demander la sauvegarde à l'iframe
        this.sendMessageToIframe({
            type: 'SAVE_SHAPE',
            data: {
                champRelation: 'Parent__c',
                idParent: this.recordId
            }
        });
    }
    
    // Effacer la sélection
    handleClearSelection() {
        try {
            // Envoyer message à l'iframe pour effacer
            this.sendMessageToIframe({
                type: 'CLEAR_ALL'
            });
            
            // Effacer la géométrie sélectionnée
            this.selectedGeometry = null;
            this.selectedAddress = '';
            
            console.log('✅ Sélection ArcGIS effacée');
            this.showToast('Sélection effacée', 'La sélection ArcGIS a été supprimée', 'info');
            
        } catch (error) {
            console.error('❌ Erreur effacement sélection:', error);
        }
    }
    
    // Centrer la carte sur un point
    handleCenterMap() {
        if (this.selectedGeometry) {
            this.sendMessageToIframe({
                type: 'CENTER_MAP',
                longitude: this.selectedGeometry.center?.longitude || this.selectedGeometry.coordinates?.[0]?.longitude,
                latitude: this.selectedGeometry.center?.latitude || this.selectedGeometry.coordinates?.[0]?.latitude,
                zoom: 15
            });
            console.log('✅ Carte centrée sur la géométrie');
        }
    }
    
    // Activer le mode dessin
    handleActivateDrawing() {
        this.sendMessageToIframe({
            type: 'ACTIVATE_DRAWING_MODE'
        });
        console.log('✅ Mode dessin activé');
    }
    
    // Désactiver le mode dessin
    handleDeactivateDrawing() {
        this.sendMessageToIframe({
            type: 'DEACTIVATE_DRAWING_MODE'
        });
        console.log('✅ Mode dessin désactivé');
    }
    
    // Afficher un toast
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}
