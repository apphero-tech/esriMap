import { LightningElement, api } from 'lwc';
import getMapAreaGeometry from '@salesforce/apex/MapAreaService.getMapAreaGeometry';

export default class EsriMapViewer extends LightningElement {
    @api recordId;
    isLoading = true;
    hasGeometry = false;
    
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
        return this.hasGeometry ? 'Localisation sur la carte' : 'Aucune géométrie disponible';
    }
    
    renderedCallback() {
        // Écouter les messages de la page Visualforce
        window.addEventListener('message', this.handleMessageFromVF.bind(this));
        
        if (this.currentRecordId) {
            // Ne pas charger immédiatement, attendre que l'iframe soit prête
            console.log('🗺️ Composant rendu, recordId:', this.currentRecordId);
        }
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
                readOnlyMode: true
            }
        };
        
        console.log('🗺️ Envoi message centrage:', JSON.stringify(message));
        this.sendMessageToVF(message);
    }
    
    // Envoyer un message à la page Visualforce
    sendMessageToVF(message) {
        const iframe = this.template.querySelector('.map-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
        }
    }
    
    // Gérer le chargement de l'iframe
    onMapReady() {
        console.log('🗺️ Iframe chargée, attente initialisation carte...');
        // Attendre que la page Visualforce soit complètement initialisée
        setTimeout(() => {
            if (this.currentRecordId) {
                this.loadGeometryFromRecord();
            }
        }, 2000); // Attendre 2 secondes pour l'initialisation complète
    }
}
