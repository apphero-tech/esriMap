import { LightningElement, api } from 'lwc';
import getMapAreaGeometry from '@salesforce/apex/MapAreaService.getMapAreaGeometry';

export default class EsriMapViewer extends LightningElement {
    @api recordId;
    @api title;
    @api initialZoom = 12;
    isLoading = true;
    hasGeometry = false;
    
    // ✅ NOUVELLES PROPRIÉTÉS POUR GESTION CORRECTE DU LISTENER
    _boundMessageHandler = null;
    _isInitialized = false;
    
    // Récupérer l'ID de l'enregistrement depuis le contexte de la page
    get currentRecordId() {
        return this.recordId || this.getRecordIdFromContext();
    }
    
    // URL de la page Visualforce avec ArcGIS
    get vfPageUrl() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/apex/ArcGISMap`;
    }

    get cardTitle() {
        if (this.title) {
            return this.title;
        }
        return this.hasGeometry ? 'Localisation sur la carte' : 'Aucune géométrie disponible';
    }
    
    // ✅ ATTACHER LE LISTENER UNE SEULE FOIS AU CONNEXION
    connectedCallback() {
        console.log('🔌 Connexion du composant esriMapViewer');
        
        // ✅ Sauvegarder la référence bound pour pouvoir la retirer plus tard
        this._boundMessageHandler = this.handleMessageFromVF.bind(this);
        window.addEventListener('message', this._boundMessageHandler);
        
        console.log('📌 Listener de messages attaché');
    }
    
    renderedCallback() {
        // ✅ UNIQUEMENT initialiser l'iframe si pas encore fait
        if (this._isInitialized) {
            return;
        }
        this._isInitialized = true;
        
        if (this.currentRecordId) {
            console.log('🗺️ Composant rendu, recordId:', this.currentRecordId);
        }
    }
    
    // ✅ NETTOYER LE LISTENER LORS DE LA DÉCONNEXION
    disconnectedCallback() {
        console.log('🧹 Nettoyage du composant esriMapViewer');
        
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            console.log('✅ Listener de messages supprimé');
            this._boundMessageHandler = null;
        }
        
        this._isInitialized = false;
    }
    
    // Gérer les messages reçus de Visualforce
    handleMessageFromVF(event) {
        const { type, data } = event.data;
        console.log('📨 Message reçu de Visualforce:', type, data);
        
        if (type === 'MAP_READY') {
            console.log('✅ Carte prête, chargement géométrie...');
            if (this.currentRecordId) {
                this.loadGeometryFromRecord();
            }
        }
    }
    
    // Récupérer l'ID de l'enregistrement depuis le contexte de la page
    getRecordIdFromContext() {
        const urlParams = new URLSearchParams(window.location.search);
        const recordId = urlParams.get('id') || 
                        window.location.pathname.split('/').pop();
        return recordId;
    }
    
    // Charger les données géométriques
    async loadGeometryFromRecord() {
        if (!this.currentRecordId) return;
        this.isLoading = true;
        try {
            const result = await getMapAreaGeometry({ recordId: this.currentRecordId });
            if (result && result.Geometry_JSON__c) {
                this.hasGeometry = true;
                this.displayGeometryOnMap(result);
            } else {
                this.hasGeometry = false;
            }
        } catch (error) {
            this.hasGeometry = false;
            console.error('Erreur géométrie:', error);
        } finally {
            this.isLoading = false;
        }
    }
    
    // Afficher la géométrie sur la carte
    displayGeometryOnMap(mapAreaData) {
        const message = {
            type: 'DISPLAY_READONLY_GEOMETRY',
            data: {
                geometryData: mapAreaData.Geometry_JSON__c,
                areaType: mapAreaData.Area_Type__c,
                latitude: mapAreaData.Latitude__c,
                longitude: mapAreaData.Longitude__c,
                address: mapAreaData.Address__c,
                autoCenter: true,
                centerCoordinates: {
                    latitude: mapAreaData.Latitude__c,
                    longitude: mapAreaData.Longitude__c
                },
                readOnlyMode: true,
                zoomLevel: this.initialZoom
            }
        };
        
        console.log('🗺️ Envoi message centrage:', JSON.stringify(message));
        this.sendMessageToVF(message);
    }
    
    // Envoyer un message à la page Visualforce
    sendMessageToVF(message) {
        const iframe = this.template.querySelector('.map-iframe');
        if (iframe && iframe.contentWindow) {
            // Utiliser l'origine Salesforce pour plus de sécurité
            const targetOrigin = window.location.origin;
            iframe.contentWindow.postMessage(message, targetOrigin);
        }
    }
    
    // Gérer le chargement de l'iframe
    onMapReady() {
        console.log('🗺️ Iframe chargée, attente du message MAP_READY...');
        // Le chargement de la géométrie est déclenché uniquement par le message MAP_READY
        // pour éviter un double chargement
    }
}