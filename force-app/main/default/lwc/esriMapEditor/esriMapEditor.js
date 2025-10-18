import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import saveMapAreas from '@salesforce/apex/MapAreaService.saveMapAreas';
import getMapAreasByIds from '@salesforce/apex/MapAreaService.getMapAreasByIds';
import getMapAreasByRelationship from '@salesforce/apex/MapAreaService.getMapAreasByRelationship';

export default class EsriMapEditor extends NavigationMixin(LightningElement) {
    @api recordId;                          // ID du Case/Account/etc
    @api relationshipFieldName;             // Nom du champ lookup (ex: Case__c)
    @api title;                             // Titre personnalisé
    @api readOnly = false;                  // Mode lecture seule
    
    // Legacy properties - kept for backward compatibility but not exposed in meta.xml for CRM
    @api champRelation;
    @api idParent;
    @api autoCenter = false;
    @api showControls = false;
    @api initialZoom = 12;
    
    isMapInitialized = false;
    coordinates = { latitude: 0, longitude: 0 };
    _isSaveButtonDisabled = true;
    isSaving = false;
    @track createdRecords = [];
    
    _columns = [];
    isLoadingRelated = false;
    errorMessage = '';
    
    // URL de la page Visualforce avec ArcGIS
    get vfPageUrl() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/apex/ArcGISMap`;
    }
    
    // Label dynamique du bouton Save Shape
    get saveButtonLabel() {
        return this.isSaving ? 'Sauvegarde...' : 'Enregistrer';
    }
    
    // Titre dynamique de la page
    get pageTitle() {
        return this.title || 'Carte ArcGIS Interactive';
    }
    
    // État du bouton (désactivé si pas de forme ou en cours de sauvegarde)
    get isSaveButtonDisabled() {
        return this._isSaveButtonDisabled || this.isSaving || this.readOnly;
    }
    
    get hasCreatedRecords() {
        return this.createdRecords && this.createdRecords.length > 0;
    }

    get showRelatedZonesSection() {
        return !this.readOnly && this.relationshipFieldName;
    }

    connectedCallback() {
        this.loadRelatedRecords();
    }

    renderedCallback() {
        if (this.isMapInitialized) {
            return;
        }
        this.isMapInitialized = true;
        this.initializeIframe();
    }

    /**
     * Charge les zones liées au Case/Account via le champ de relation
     */
    async loadRelatedRecords() {
        if (!this.recordId || !this.relationshipFieldName) {
            console.log('ℹ️ recordId ou relationshipFieldName absent - pas de chargement des zones liées');
            return;
        }

        this.isLoadingRelated = true;
        this.errorMessage = '';

        try {
            const relatedRecords = await getMapAreasByRelationship({ 
                parentRecordId: this.recordId, 
                relationshipFieldName: this.relationshipFieldName 
            });

            // Transformer la Map en tableau
            const recordsArray = [];
            for (const [id, record] of Object.entries(relatedRecords)) {
                const url = await this[NavigationMixin.GenerateUrl]({
                    type: 'standard__recordPage',
                    attributes: { recordId: id, actionName: 'view' }
                });
                recordsArray.push({
                    id,
                    url,
                    name: record.Name || id,
                    address: record.Address__c || '',
                    latitude: record.Latitude__c || null,
                    longitude: record.Longitude__c || null,
                    type: record.Area_Type__c || '',
                    createdByName: record.CreatedBy ? record.CreatedBy.Name : '',
                    createdDate: record.CreatedDate || null,
                    geoJson: record.Geometry_JSON__c || ''
                });
            }

            this.createdRecords = recordsArray;
            console.log(`✅ ${recordsArray.length} zone(s) liée(s) chargée(s)`);

        } catch (error) {
            console.error('❌ Erreur lors du chargement des zones liées:', error);
            this.errorMessage = 'Erreur lors du chargement des zones liées au ' + (this.relationshipFieldName || 'parent');
        } finally {
            this.isLoadingRelated = false;
        }
    }

    // Initialiser l'iframe
    initializeIframe() {
        console.log('🗺️ Initialisation iframe carte');
        // L'iframe se charge automatiquement via l'attribut src
    }
    
    // Gérer le chargement de l'iframe
    onMapReady() {
        console.log('🗺️ Iframe carte chargée');
        // La carte est prête pour l'utilisation
        // Écouter les messages de Visualforce
        window.addEventListener('message', this.handleMessageFromVF.bind(this));
    }
    
    // Gérer la sauvegarde de la forme
    handleSaveShape() {
        if (this.isSaving || this.readOnly) return;
        
        this.isSaving = true;
        console.log('💾 Sauvegarde de la forme...');
        
        // Envoyer le message de sauvegarde à Visualforce
        // En mode CRM avec relationshipFieldName, on doit passer le recordId et le champ
        this.sendMessageToVF({
            type: 'SAVE_SHAPE',
            data: {
                parentRecordId: this.recordId,
                relationshipFieldName: this.relationshipFieldName,
                // Backward compat
                champRelation: this.champRelation,
                idParent: this.idParent
            }
        });
    }
    
    // Gérer l'action Annuler
    handleCancel() {
        // Demander au VF de tout effacer et revenir à l'état initial
        this.sendMessageToVF({ type: 'CLEAR_ALL', data: {} });
        // Réinitialiser l'état local
        this._isSaveButtonDisabled = true;
        this.coordinates = { latitude: 0, longitude: 0 };
        this.isSaving = false;
    }
    
    // Envoyer un message à la page Visualforce
    sendMessageToVF(message) {
        const iframe = this.template.querySelector('.map-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(message, '*');
        } else {
            console.warn('⚠️ Iframe non trouvée pour envoi de message');
        }
    }
    
    // Gérer les messages reçus de Visualforce
    handleMessageFromVF(event) {
        console.log('🔍 handleMessageFromVF appelé avec:', event);
        
        // STANDARD SALESFORCE: Accepter les messages des domaines Visualforce et Lightning
        const isSalesforceDomain = event.origin.includes('force.com') || 
                                  event.origin.includes('salesforce.com') ||
                                  event.origin.includes('vf.force.com') ||
                                  event.origin.includes('.my.site.com');
        
        if (!isSalesforceDomain) {
            console.log('⚠️ Domaine non autorisé, message ignoré:', event.origin);
            return;
        }
        
        const { type, data } = event.data;
        console.log('📨 Message reçu de Visualforce:', type, data);
        
        switch (type) {
            case 'SHAPE_SELECTED':
                this._isSaveButtonDisabled = false;
                if (data.shape && data.shape.coordinates && data.shape.coordinates.length > 0) {
                    this.coordinates = data.shape.coordinates[0];
                }
                console.log('✅ Forme sélectionnée, bouton Save activé');
                break;
                
            case 'SHAPE_DATA':
                // Appel Apex depuis LWC pour créer l'enregistrement réel
                // Réinitialiser le flag isSaving pour permettre le traitement
                this.isSaving = false;
                
                const payloadShape = (data && (data.shapeData || data)) || (event.data && (event.data.shapeData || event.data.data && event.data.data.shapeData));
                if (payloadShape) {
                    console.log('💾 Traitement SHAPE_DATA:', payloadShape);
                    this.saveShapeViaApex(payloadShape);
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('SHAPE_DATA reçu sans contenu exploitable:', event.data);
                    this.isSaving = false;
                }
                break;
                
            case 'NO_SHAPE_SELECTED':
                this._isSaveButtonDisabled = true;
                console.log('❌ Aucune forme sélectionnée, bouton Save désactivé');
                break;
                
            case 'SAVE_SUCCESS':
                this.isSaving = false;
                this._isSaveButtonDisabled = true;
                this.showToast('Succès', 'Forme sauvegardée avec succès', 'success');
                // Recharger les zones liées
                this.loadRelatedRecords();
                break;
                
            case 'SAVE_ERROR':
                this.isSaving = false;
                this.showToast('Erreur', 'Erreur lors de la sauvegarde: ' + data.error, 'error');
                break;
                
            case 'COORDINATES_UPDATE':
                this.coordinates = data.coordinates;
                break;
                
            case 'NAVIGATE_TO_RECORD':
                console.log('🔗 Navigation vers l\'enregistrement:', data);
                // Navigation automatique désactivée
                break;
        }
    }
    
    // Sauvegarder via Apex (appel depuis SHAPE_DATA reçu de VF)
    async saveShapeViaApex(shapeData) {
        try {
            this.isSaving = true;
            console.log('🔍 shapeData reçu:', JSON.stringify(shapeData));
            
            // Adapter au contrat Apex: saveMapAreas(List<ShapeData>, parentRecordId, relationshipFieldName)
            const payload = [{
                name: shapeData.name || 'Point',
                areaType: shapeData.areaType,
                geoJson: shapeData.geoJson,
                latitude: parseFloat(shapeData.latitude),
                longitude: parseFloat(shapeData.longitude),
                address: shapeData.address
            }];

            console.log('📤 Payload envoyé à Apex:', JSON.stringify(payload));
            console.log('📍 Context: parentRecordId=' + this.recordId + ', relationshipFieldName=' + this.relationshipFieldName);
            const result = await saveMapAreas({ 
                shapesData: payload,
                parentRecordId: this.recordId,
                relationshipFieldName: this.relationshipFieldName
            });
            console.log('📥 Résultat Apex reçu:', JSON.stringify(result));
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

                this.isSaving = false;
                this._isSaveButtonDisabled = true;
                this.showToast('Succès', result.message || 'Forme sauvegardée avec succès', 'success');
            } else {
                this.isSaving = false;
                const message = (result && result.message) ? result.message : 'Erreur inconnue lors de la sauvegarde';
                const details = (result && result.errorDetails && result.errorDetails.length)
                    ? ' Détails: ' + result.errorDetails.map(e => e.errorMessage).join(' | ')
                    : '';
                // Log complet pour debug
                // eslint-disable-next-line no-console
                console.error('SAVE_ERROR result:', JSON.stringify(result));
                this.showToast('Erreur', message + details, 'error');
            }
        } catch (e) {
            this.isSaving = false;
            this.showToast('Erreur', e && e.body && e.body.message ? e.body.message : (e.message || 'Erreur Apex'), 'error');
        }
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
        this.sendMessageToVF({
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
        this.sendMessageToVF({ type: 'DISPLAY_SAVED_SHAPE', geometryData, areaType, autoCenter: true });
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
    
    disconnectedCallback() {
        window.removeEventListener('message', this.handleMessageFromVF.bind(this));
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

    renderedCallback() {
        if (!this._resizeBound) {
            this._resizeBound = true;
            window.addEventListener('resize', () => this.recomputeColumns());
        }
        this.recomputeColumns();
    }

    recomputeColumns() {
        try {
            const container = this.template.querySelector('.enregistrements-container') || this.template.querySelector('.slds-card__body');
            if (!container) return;
            const available = container.clientWidth || 1000;
            const nextCols = this.buildColumns(available);
            // Compare shallowly by initialWidth and labels to avoid infinite re-renders
            const prev = this._columns;
            const changed = !prev || prev.length !== nextCols.length || prev.some((c, i) => {
                const n = nextCols[i];
                return c.initialWidth !== n.initialWidth || c.label !== n.label || c.fieldName !== n.fieldName;
            });
            if (changed) {
                this._columns = nextCols;
            }
        } catch (e) {
            // ignore
        }
    }

    buildColumns(containerWidth) {
        // Largeurs fixes des colonnes compactes (px)
        const widthName = 140;
        const widthLat = 130;
        const widthLong = 130;
        const widthType = 130;
        const widthCreatedBy = 130;
        const widthCreatedDate = 130;
        const widthAction = 160;
        const widthRowNum = 56; // colonne numéros de ligne de lightning-datatable
        const paddings = 48; // marge approximative
        const sumFixed = widthRowNum + widthName + widthLat + widthLong + widthType + widthCreatedBy + widthCreatedDate + widthAction + paddings;
        const addressWidth = Math.max(320, containerWidth - sumFixed);
        return [
            { label: 'Nom', fieldName: 'url', type: 'url', initialWidth: widthName, typeAttributes: { label: { fieldName: 'name' }, target: '_blank' } },
            { label: 'Adresse', fieldName: 'address', wrapText: true, initialWidth: addressWidth },
            { label: 'Latitude', fieldName: 'latitude', type: 'number', initialWidth: widthLat, cellAttributes: { alignment: 'left' } },
            { label: 'Longitude', fieldName: 'longitude', type: 'number', initialWidth: widthLong, cellAttributes: { alignment: 'left' } },
            { label: 'Type', fieldName: 'type', initialWidth: widthType },
            { label: 'Créé par', fieldName: 'createdByName', initialWidth: widthCreatedBy },
            { label: 'Date de création', fieldName: 'createdDate', type: 'date', initialWidth: widthCreatedDate, typeAttributes: { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } },
            { type: 'action', typeAttributes: { rowActions: [ { label: 'Voir sur la carte', name: 'view_on_map' } ] }, initialWidth: widthAction }
        ];
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