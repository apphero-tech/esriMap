import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import saveMapAreas from '@salesforce/apex/MapAreaService.saveMapAreas';
import getMapAreasByIds from '@salesforce/apex/MapAreaService.getMapAreasByIds';

export default class EsriMapEditor extends NavigationMixin(LightningElement) {
    @api champRelation;
    @api idParent;
    @api showSaveButton = false;

    @track saveDisabled = true;
    @track saving = false;
    @track createdRecords = [];
    
    _columns = [];

    get isSaveButtonDisabled() {
        return this.saveDisabled || this.saving;
    }

    get hasCreatedRecords() {
        return this.createdRecords && this.createdRecords.length > 0;
    }

    connectedCallback() {
        window.addEventListener('message', this.handleVfMessage);
    }

    disconnectedCallback() {
        window.removeEventListener('message', this.handleVfMessage);
    }

    get vfPageUrl() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/apex/ArcGISMap`;
    }

    onIframeLoad = () => {
        // noop, VF will send MAP_READY when initialized
    };

    handleVfMessage = (event) => {
        const data = event && event.data ? event.data : undefined;
        if (!data || !data.type) return;

        switch (data.type) {
            case 'MAP_READY': {
                this.saveDisabled = false; // enable once map is ready and tools active
                break;
            }
            case 'NO_SHAPE_SELECTED': {
                this.saveDisabled = true;
                break;
            }
            case 'SHAPE_SELECTED': {
                this.saveDisabled = false;
                break;
            }
            case 'SHAPE_DATA': {
                this.persistShapeData(data.data && data.data.shapeData ? [data.data.shapeData] : []);
                break;
            }
            case 'SAVE_ERROR': {
                this.saving = false;
                this.showToast('Erreur', (data.data && data.data.error) || 'Erreur de sauvegarde', 'error');
                break;
            }
            default:
                break;
        }
    };

    handleSave = () => {
        if (this.saving) return;
        this.saving = true;
        // Ask VF to compile current shapes and return SHAPE_DATA
        this.postToVf({
            type: 'SAVE_SHAPE',
            data: { champRelation: this.champRelation, idParent: this.idParent }
        });
    };

    postToVf(message) {
        const iframe = this.template.querySelector('.map-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
        }
    }

    async persistShapeData(shapesData) {
        if (!shapesData || shapesData.length === 0) {
            this.saving = false;
            this.showToast('Alerte', 'Aucune forme à sauvegarder', 'warning');
            return;
        }
        try {
            this.isSaving = true;
            // Adapter au contrat Apex: saveMapAreas(List<ShapeData>)
            const payload = [{
                name: shapesData[0].name,
                areaType: shapesData[0].areaType,
                geoJson: shapesData[0].geoJson,
                latitude: shapesData[0].latitude,
                longitude: shapesData[0].longitude,
                address: shapesData[0].address
            }];

            const result = await saveMapAreas({ shapesData: payload });
            if (result && result.success && result.recordIds && result.recordIds.length > 0) {
                // Enrichir via Apex pour récupérer Name standard, adresse, coords, auteur et date
                let summaries = {};
                try {
                    summaries = await getMapAreasByIds({ recordIds: result.recordIds });
                } catch (e) {
                    summaries = {};
                }
                const newItems = [];
                for (let id of result.recordIds) {
                    const url = await this[NavigationMixin.GenerateUrl]({
                        type: 'standard__recordPage',
                        attributes: { recordId: id, actionName: 'view' }
                    });
                    const s = summaries && summaries[id] ? summaries[id] : null;
                    newItems.push({
                        id,
                        url,
                        name: s && s.Name ? s.Name : id,
                        address: s && s.Address__c ? s.Address__c : (payload[0].address || ''),
                        latitude: s && s.Latitude__c ? s.Latitude__c : null,
                        longitude: s && s.Longitude__c ? s.Longitude__c : null,
                        type: s && s.Area_Type__c ? s.Area_Type__c : (payload[0].areaType || ''),
                        createdByName: s && s.CreatedBy ? s.CreatedBy.Name : '',
                        createdDate: s && s.CreatedDate ? s.CreatedDate : null,
                        geoJson: s && s.Geometry_JSON__c ? s.Geometry_JSON__c : (payload[0].geoJson || '')
                    });
                }
                this.createdRecords = [...newItems, ...this.createdRecords];

                this.saving = false;
                this.saveDisabled = true;
                this.showToast('Succès', result.message || 'Zone(s) enregistrée(s)', 'success');
                this.postToVf({ type: 'CLEAR_ALL' });
            } else {
                this.saving = false;
                const message = (result && result.message) ? result.message : 'Erreur inconnue lors de la sauvegarde';
                const details = (result && result.errorDetails && result.errorDetails.length)
                    ? ' Détails: ' + result.errorDetails.map(e => e.errorMessage).join(' | ')
                    : '';
                this.showToast('Erreur', message + details, 'error');
            }
        } catch (e) {
            this.saving = false;
            this.showToast('Erreur', e && e.body && e.body.message ? e.body.message : (e.message || 'Erreur Apex'), 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    // Clic sur une ligne: afficher/centrer la forme sur la carte (hybride cache/Apex)
    async handleRowClick(event) {
        const recordId = event.currentTarget.dataset.id;
        const rec = this.createdRecords.find(r => r.id === recordId);
        let areaType = rec?.type;
        let geometryData = rec?.geoJson; // si présent en cache

        if (!geometryData) {
            // Fallback Apex si pas en cache
            try {
                const res = await fetch(`/services/data/v64.0/sobjects/Map_Area__c/${recordId}`);
                if (res.ok) {
                    const data = await res.json();
                    geometryData = data.Geometry_JSON__c;
                    areaType = data.Area_Type__c;
                }
            } catch (e) {
                // ignorer
            }
        }
        if (!geometryData || !areaType) return;

        // Envoyer au VF
        this.postToVf({
            type: 'DISPLAY_SAVED_SHAPE',
            geometryData,
            areaType,
            autoCenter: true
        });
    }

    async handleViewOnMap(event) {
        const recordId = event.currentTarget.dataset.id;
        const rec = this.createdRecords.find(r => r.id === recordId);
        let areaType = rec?.type;
        let geometryData = rec?.geoJson;
        if (!geometryData) {
            try {
                const summaries = await getMapAreasByIds({ recordIds: [recordId] });
                const s = summaries && summaries[recordId] ? summaries[recordId] : null;
                if (s) {
                    geometryData = s.Geometry_JSON__c;
                    areaType = s.Area_Type__c;
                }
            } catch (e) {}
        }
        if (!geometryData || !areaType) return;
        this.postToVf({ type: 'DISPLAY_SAVED_SHAPE', geometryData, areaType, autoCenter: true });
    }

    // Lightning-datatable columns config
    get columns() {
        return [
            { label: 'Nom', fieldName: 'url', type: 'url', initialWidth: 120, typeAttributes: { label: { fieldName: 'name' }, target: '_blank' } },
            { label: 'Adresse', fieldName: 'address', type: 'text', wrapText: true, initialWidth: 250 },
            { label: 'Latitude', fieldName: 'latitude', type: 'number', initialWidth: 100, cellAttributes: { alignment: 'left' }, typeAttributes: { minimumFractionDigits: 6, maximumFractionDigits: 6 } },
            { label: 'Longitude', fieldName: 'longitude', type: 'number', initialWidth: 100, cellAttributes: { alignment: 'left' }, typeAttributes: { minimumFractionDigits: 6, maximumFractionDigits: 6 } },
            { label: 'Type', fieldName: 'type', type: 'text', initialWidth: 80 },
            { label: 'Créé par', fieldName: 'createdByName', type: 'text', initialWidth: 120 },
            { label: 'Date', fieldName: 'createdDate', type: 'date-local', initialWidth: 140, typeAttributes: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } },
            { type: 'action', typeAttributes: { rowActions: [ { label: 'Voir sur la carte', name: 'view_on_map' } ] }, initialWidth: 90 }
        ];
    }

    get tableRows() {
        return this.createdRecords;
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'view_on_map') {
            // Simuler le clic bouton précédent
            const fakeEvt = { currentTarget: { dataset: { id: row.id } } };
            this.handleViewOnMap(fakeEvt);
        }
    }
}



