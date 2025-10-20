import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import saveMapAreas from '@salesforce/apex/MapAreaService.saveMapAreas';
import getMapAreasByIds from '@salesforce/apex/MapAreaService.getMapAreasByIds';
import getMapAreasByRelationship from '@salesforce/apex/MapAreaService.getMapAreasByRelationship';
import deleteMapArea from '@salesforce/apex/MapAreaService.deleteMapArea';
import deleteMapAreas from '@salesforce/apex/MapAreaService.deleteMapAreas';

let listenerCount = 0;

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
    isDeleting = false;
    @track createdRecords = [];
    
    // ✅ NOUVELLES PROPRIÉTÉS POUR LIFECYCLE MANAGEMENT
    _previousRecordId = null;
    _boundMessageHandler = null;
    _resizeBound = false;
    _messageProcessingLock = false;     // Protection contra race conditions simples
    _lastMessageId = null;              // ID du dernier message pour détection basique
    _vfPageUrl = null;                  // Cache de l'URL VF pour éviter les recharges inutiles
    
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
        // Déterminer si c'est un changement de record
        if (this._previousRecordId && this._previousRecordId !== this.recordId) {
            console.warn('🔄 CHANGEMENT DE CASE DÉTECTÉ:', this._previousRecordId, '→', this.recordId);
            this._cleanupOnRecordChange();
        }
        
        this._previousRecordId = this.recordId;
        
        // Détacher l'ancien listener si présent (en cas de changement de case)
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            this._boundMessageHandler = null;
        }
        
        // Créer une nouvelle référence stable à la fonction
        this._boundMessageHandler = this.handleMessageFromVF.bind(this);
        window.addEventListener('message', this._boundMessageHandler);
        listenerCount++;
        
        // Charger les zones liées au record
        this.loadRelatedRecords();
    }
    
    // ✅ NOUVELLE MÉTHODE : Nettoyer les listeners quand le composant est détruit
    disconnectedCallback() {
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
            listenerCount--;
            this._boundMessageHandler = null;
        }
    }
    
    // ✅ NOUVELLE MÉTHODE : NETTOYER LORS DU CHANGEMENT DE CASE
    _cleanupOnRecordChange() {
        // Réinitialiser l'état local
        this._isSaveButtonDisabled = true;
        this.isSaving = false;
        this.coordinates = { latitude: 0, longitude: 0 };
        this.createdRecords = [];
        this._messageProcessingLock = false;
        this._lastMessageId = null;
        
        // Réinitialiser la carte
        this.isMapInitialized = false;
        
        // Demander au Visualforce de réinitialiser la carte
        this.sendMessageToVF({ type: 'CLEAR_ALL', data: {} });
    }

    renderedCallback() {
        // Initialisation de l'iframe si pas encore fait
        if (this.isMapInitialized) {
            return;
        }
        this.isMapInitialized = true;
        this.initializeIframe();
        
        // ✅ RÉINITIALISER LE LAYOUT DES COLONNES
        if (!this._resizeBound) {
            this._resizeBound = true;
            window.addEventListener('resize', () => this.recomputeColumns());
        }
        this.recomputeColumns();
    }

    /**
     * Charge les zones liées au Case/Account via le champ de relation
     */
    async loadRelatedRecords() {
        if (!this.recordId || !this.relationshipFieldName) {
            return;
        }

        this.isLoadingRelated = true;
        this.errorMessage = '';

        try {
            const relatedRecords = await getMapAreasByRelationship({ 
                parentRecordId: this.recordId, 
                relationshipFieldName: this.relationshipFieldName
            });

            // ✅ Convertir la Map retournée par Apex en Array
            // Apex retourne: Map<Id, Map_Area__c>
            // JavaScript reçoit: Object { id1: {record}, id2: {record}, ... }
            const recordsArray = relatedRecords ? Object.values(relatedRecords) : [];
            
            const mappedRecords = recordsArray.map(record => ({
                id: record.Id,
                name: record.Name,
                address: record.Address__c,
                latitude: record.Latitude__c,
                longitude: record.Longitude__c,
                type: record.Area_Type__c,
                createdByName: record.CreatedBy?.Name || 'N/A',
                createdDate: this.formatDate(record.CreatedDate),
                createdDateRaw: record.CreatedDate, // Stocker la date brute pour le tri
                url: '/' + record.Id
            }));

            // ✅ Trier par date de création (plus récent en premier)
            this.createdRecords = this.sortByCreatedDateDesc(mappedRecords);

            this.isLoadingRelated = false;
        } catch (error) {
            console.error('❌ Erreur lors du chargement des zones liées:', error.body?.message || error.message);
            this.errorMessage = 'Erreur lors du chargement des zones liées';
            this.isLoadingRelated = false;
        }
    }

    /**
     * Trier les records par date de création (plus récent en premier)
     */
    sortByCreatedDateDesc(records) {
        return records.sort((a, b) => {
            const dateA = new Date(a.createdDateRaw || 0);
            const dateB = new Date(b.createdDateRaw || 0);
            return dateB - dateA; // Ordre décroissant (plus récent en premier)
        });
    }

    // Initialiser l'iframe
    initializeIframe() {
        // Le contexte sera envoyé via le handler MAP_READY quand la VF sera prête
    }
    
    // Gérer la sauvegarde de la forme
    handleSaveShape() {
        if (this.isSaving || this.readOnly) {
            console.warn('⚠️ Sauvegarde ignorée - déjà en cours ou mode lecture seule');
            return;
        }
        
        // ✅ VALIDATION STRICTE
        if (!this.recordId || !this.relationshipFieldName) {
            console.error('❌ Contexte manquant pour la sauvegarde');
            this.showToast('Erreur', 'Contexte de sauvegarde manquant', 'error');
            return;
        }
        
        const saveShapeId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        this.sendMessageToVF({
            type: 'SAVE_SHAPE',
            saveShapeId: saveShapeId,
            data: {
                recordId: this.recordId,
                relationshipFieldName: this.relationshipFieldName,
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

    // Formater la date pour l'affichage
    formatDate(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }
    
    // Gérer les messages reçus de Visualforce
    handleMessageFromVF(event) {
        // STANDARD SALESFORCE: Accepter les messages des domaines Visualforce et Lightning
        const isSalesforceDomain = event.origin.includes('force.com') || 
                                  event.origin.includes('salesforce.com') ||
                                  event.origin.includes('vf.force.com') ||
                                  event.origin.includes('.my.site.com');
        
        if (!isSalesforceDomain) {
            console.warn('⚠️ Domaine non autorisé, message ignoré:', event.origin);
            return;
        }
        
        const { type, data } = event.data;
        
        switch (type) {
            case 'MAP_READY':
                this.sendMessageToVF({
                    type: 'UPDATE_CONTEXT',
                    data: {
                        recordId: this.recordId,
                        relationshipFieldName: this.relationshipFieldName,
                        readOnly: this.readOnly
                    }
                });
                break;
                
            case 'SHAPE_SELECTED':
                this._isSaveButtonDisabled = false;
                if (data.shape && data.shape.coordinates && data.shape.coordinates.length > 0) {
                    this.coordinates = data.shape.coordinates[0];
                }
                break;
                
            case 'SHAPE_DATA':
                const messageData = (data && (data.shapeData || data)) || (event.data && (event.data.shapeData || event.data.data && event.data.data.shapeData));
                const messageIdentifier = messageData ? JSON.stringify({
                    lat: messageData.latitude,
                    lng: messageData.longitude,
                    addr: messageData.address,
                    type: messageData.areaType
                }) : null;
                
                if (messageIdentifier && this._lastMessageId === messageIdentifier) {
                    return;
                }
                
                if (this._messageProcessingLock) {
                    console.warn('⚠️ TRAITEMENT EN COURS - Message rejeté');
                    return;
                }
                
                if (this.isSaving) {
                    console.warn('⚠️ Sauvegarde déjà en cours, message SHAPE_DATA ignoré');
                    return;
                }
                
                const payloadShape = messageData;
                const contextRecordId = data?.recordId ?? this.recordId;
                const contextRelationshipField = data?.relationshipFieldName ?? this.relationshipFieldName;
                
                // ✅ NOUVEAU: Rejeter le message si le recordId du message ne correspond pas au contexte actuel
                if (data?.recordId && data.recordId !== this.recordId) {
                    console.warn('❌ REJET: Message depuis ancien contexte (recordId: ' + data.recordId + ' vs actuel: ' + this.recordId + ')');
                    return;
                }
                
                if (!contextRecordId || !contextRelationshipField) {
                    console.error('❌ CONTEXTE MANQUANT');
                    this.showToast('Erreur', 'Contexte de sauvegarde manquant', 'error');
                    return;
                }
                
                if (payloadShape) {
                    this._messageProcessingLock = true;
                    this._lastMessageId = messageIdentifier;
                    this.isSaving = true;
                    
                    this.saveShapeViaApex(payloadShape, contextRecordId, contextRelationshipField);
                }
                break;
                
            case 'NO_SHAPE_SELECTED':
                this._isSaveButtonDisabled = true;
                break;
                
            case 'SAVE_SUCCESS':
                this.isSaving = false;
                this._isSaveButtonDisabled = true;
                this.showToast('Succès', 'Forme sauvegardée avec succès', 'success');
                this.loadRelatedRecords();
                break;
                
            case 'SAVE_ERROR':
                this.isSaving = false;
                this.showToast('Erreur', 'Erreur lors de la sauvegarde: ' + data.error, 'error');
                break;
                
            case 'COORDINATES_UPDATE':
                this.coordinates = data.coordinates;
                break;
        }
    }
    
    // Sauvegarder via Apex (appel depuis SHAPE_DATA reçu de VF)
    async saveShapeViaApex(shapeData, capturedRecordId = null, capturedRelationshipField = null) {
        try {
            // ✅ VALIDATION STRICTE DU CONTEXTE AVEC TIMESTAMP ET ID UNIQUE
            const timestamp = new Date().toISOString();
            const sessionId = Math.random().toString(36).substr(2, 9);
            
            // ✅ UTILISER LE CONTEXTE CAPTURÉ OU ACTUEL
            const currentRecordId = capturedRecordId || this.recordId;
            const currentRelationshipField = capturedRelationshipField || this.relationshipFieldName;
            
            
            if (!currentRecordId || !currentRelationshipField) {
                const errorMsg = `Contexte de liaison manquant: currentRecordId=${currentRecordId}, currentRelationshipField=${currentRelationshipField}`;
                console.error('❌ ' + errorMsg);
                throw new Error(errorMsg);
            }
            
            // Adapter au contrat Apex: saveMapAreas(List<ShapeData>, parentRecordId, relationshipFieldName)
            const payload = [{
                name: shapeData.name || 'Point',
                areaType: shapeData.areaType,
                geoJson: shapeData.geoJson,
                latitude: parseFloat(shapeData.latitude),
                longitude: parseFloat(shapeData.longitude),
                address: shapeData.address
            }];

            
            // ✅ VALIDATION FINALE DU CONTEXTE AVANT APPEL APEX
            if (!currentRecordId || !currentRelationshipField) {
                throw new Error(`Contexte perdu avant appel Apex: currentRecordId=${currentRecordId}, currentRelationshipField=${currentRelationshipField}`);
            }
            
            
            const result = await saveMapAreas({ 
                shapesData: payload,
                parentRecordId: currentRecordId,
                relationshipFieldName: currentRelationshipField
            });
            
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
                    const createdDateRaw = s && s.CreatedDate ? s.CreatedDate : null;
                    newItems.push({
                        id,
                        url,
                        name: s && s.Name ? s.Name : id,
                        address: s && s.Address__c ? s.Address__c : (payload[0].address || ''),
                        latitude: s && s.Latitude__c ? s.Latitude__c : null,
                        longitude: s && s.Longitude__c ? s.Longitude__c : null,
                        type: s && s.Area_Type__c ? s.Area_Type__c : (payload[0].areaType || ''),
                        createdByName: s && s.CreatedBy ? s.CreatedBy.Name : '',
                        createdDate: createdDateRaw ? this.formatDate(createdDateRaw) : '',
                        createdDateRaw: createdDateRaw, // Stocker la date brute pour le tri
                        geoJson: s && s.Geometry_JSON__c ? s.Geometry_JSON__c : (payload[0].geoJson || '')
                    });
                }
                this.createdRecords = [...newItems, ...this.createdRecords];
                this.createdRecords = this.sortByCreatedDateDesc(this.createdRecords); // Trier après ajout

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
        } finally {
            // ✅ RÉINITIALISER LE FLAG DANS TOUS LES CAS
            this.isSaving = false;
            this._messageProcessingLock = false;
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

    /**
     * Supprimer une forme individuelle
     */
    async handleDeleteOne(event) {
        const recordId = event.currentTarget.dataset.id;
        const rec = this.createdRecords.find(r => r.id === recordId);
        
        if (!rec) return;
        
        // Demander confirmation
        const confirmed = await this.showConfirmationDialog(
            'Supprimer',
            `Êtes-vous sûr de vouloir supprimer "${rec.name}" ?`
        );
        
        if (!confirmed) return;
        
        this.isDeleting = true;
        try {
            const result = await deleteMapArea({ recordId: recordId });
            
            if (result.success) {
                // Retirer de la liste localement
                this.createdRecords = this.createdRecords.filter(r => r.id !== recordId);
                this.showToast('Succès', `"${rec.name}" a été supprimé avec succès`, 'success');
            } else {
                this.showToast('Erreur', result.message || 'Erreur lors de la suppression', 'error');
            }
        } catch (error) {
            console.error('Erreur suppression individuelle:', error);
            this.showToast('Erreur', error.body?.message || 'Erreur lors de la suppression', 'error');
        } finally {
            this.isDeleting = false;
        }
    }

    /**
     * Supprimer tous les enregistrements créés
     */
    async handleDeleteAll() {
        const count = this.createdRecords.length;
        
        if (count === 0) {
            this.showToast('Info', 'Aucun enregistrement à supprimer', 'info');
            return;
        }
        
        // Demander confirmation
        const confirmed = await this.showConfirmationDialog(
            'Supprimer tous les enregistrements',
            `Êtes-vous sûr de vouloir supprimer ${count} enregistrement${count > 1 ? 's' : ''} ? Cette action est irréversible.`
        );
        
        if (!confirmed) return;
        
        this.isDeleting = true;
        try {
            const recordIds = this.createdRecords.map(r => r.id);
            const result = await deleteMapAreas({ recordIds: recordIds });
            
            if (result.success) {
                // Vider la liste localement
                this.createdRecords = [];
                this.showToast('Succès', `${result.deletedCount} enregistrement${result.deletedCount > 1 ? 's' : ''} supprimé${result.deletedCount > 1 ? 's' : ''} avec succès`, 'success');
            } else {
                this.showToast('Erreur', result.message || 'Erreur lors de la suppression', 'error');
            }
        } catch (error) {
            console.error('Erreur suppression en masse:', error);
            this.showToast('Erreur', error.body?.message || 'Erreur lors de la suppression', 'error');
        } finally {
            this.isDeleting = false;
        }
    }

    /**
     * Afficher un dialog de confirmation simple
     */
    showConfirmationDialog(title, message) {
        return new Promise((resolve) => {
            // Utiliser un confirmdialog natif du navigateur pour la simplicité
            // En production, vous pourriez utiliser un composant LWC plus sophistiqué
            const result = confirm(`${title}\n\n${message}`);
            resolve(result);
        });
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