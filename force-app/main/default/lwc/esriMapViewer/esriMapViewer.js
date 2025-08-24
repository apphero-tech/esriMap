import { LightningElement, api } from 'lwc';
import getMapAreaGeometry from '@salesforce/apex/MapAreaService.getMapAreaGeometry';

export default class EsriMapViewer extends LightningElement {
    @api recordId;
    
    // Récupérer l'ID de l'enregistrement depuis le contexte de la page
    get currentRecordId() {
        return this.recordId || this.getRecordIdFromContext();
    }
    
    // URL de la page Visualforce avec ArcGIS
    get vfPageUrl() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/apex/ArcGISMap`;
    }
    
    renderedCallback() {
        if (this.currentRecordId) {
            this.loadGeometryFromRecord();
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
        
        try {
            const result = await getMapAreaGeometry({ recordId: this.currentRecordId });
            
            if (result && result.Geometry_JSON__c) {
                this.displayGeometryOnMap(result);
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la géométrie:', error);
        }
    }
    
    // Afficher la géométrie sur la carte
    displayGeometryOnMap(mapAreaData) {
        const message = {
            type: 'DISPLAY_READONLY_GEOMETRY',
            data: {
                geometry: mapAreaData.Geometry_JSON__c,
                areaType: mapAreaData.Area_Type__c,
                latitude: mapAreaData.Latitude__c,
                longitude: mapAreaData.Longitude__c,
                address: mapAreaData.Address__c,
                readOnlyMode: true
            }
        };
        
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
        if (this.currentRecordId) {
            this.loadGeometryFromRecord();
        }
    }
}
