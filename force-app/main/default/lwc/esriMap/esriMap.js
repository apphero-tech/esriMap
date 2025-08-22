import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import saveMapAreas from '@salesforce/apex/MapAreaService.saveMapAreas';

export default class EsriMap extends LightningElement {
    @api champRelation;
    @api idParent;
    
    isMapInitialized = false;
    
    // Coordonnées du dernier clic pour géocodage
    coordinates = { latitude: 0, longitude: 0 };
    
    // État du bouton Save Shape
    _isSaveButtonDisabled = true;
    isSaving = false;
    

    
    // URL de la page Visualforce avec ArcGIS
    get vfPageUrl() {
        const baseUrl = window.location.origin;
        return `${baseUrl}/apex/ArcGISMap`;
    }
    
    // Label dynamique du bouton Save Shape
    get saveButtonLabel() {
        return this.isSaving ? 'Sauvegarde...' : 'Save Shape';
    }
    
    // État du bouton (désactivé si pas de forme ou en cours de sauvegarde)
    get isSaveButtonDisabled() {
        return this._isSaveButtonDisabled || this.isSaving;
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
                
            case 'SHAPE_SELECTED':
                this.onShapeSelected(event.data.shape);
                break;
                
            case 'NO_SHAPE_SELECTED':
                this.onNoShapeSelected();
                break;
                
            case 'CURRENT_SHAPES_RESPONSE':
                this.onCurrentShapesResponse(event.data);
                break;
                
            case 'ADDRESS_SELECTED':
                this.onAddressSelected(event.data.address);
                break;
                

        }
    }
    
    onMapReady() {
        // Carte ArcGIS opérationnelle
        console.log('Map is ready');
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
    
    // Méthode pour gérer la sélection d'une adresse
    onAddressSelected(addressData) {
        console.log('📍 Adresse sélectionnée:', addressData);
        
        // Convertir l'adresse en format compatible avec le système de sauvegarde
        const shapeData = {
            type: 'Adresse',
            coordinates: addressData.coordinates,
            center: addressData.center,
            address: addressData.address,
            isAddress: true
        };
        
        // Traiter comme une forme normale
        this.onShapeSelected(shapeData);
        
        console.log('✅ Adresse convertie en forme et sélectionnée');
    }
    
    onShapeSelected(shape) {
        // Stocker la forme sélectionnée
        this.selectedShape = shape;
        
        // Activer le bouton quand une forme est sélectionnée
        this._isSaveButtonDisabled = false;
        console.log('🎨 Forme sélectionnée et stockée:', shape);
    }
    
    onNoShapeSelected() {
        // Désactiver le bouton quand aucune forme n'est sélectionnée
        this._isSaveButtonDisabled = true;
        console.log('❌ Aucune forme sélectionnée');
    }
    
    onCurrentShapesResponse(data) {
        console.log('📊 Réponse des formes actuelles:', data);
        
        if (data.totalCount === 0) {
            console.log('❌ Aucune forme disponible sur la carte');
            this.showToast('Information', 'Aucune forme sélectionnée', 'info');
            this.isSaving = false;
            return;
        }
        
        // Transformer les formes en données pour Salesforce avec validation
        const shapesData = [];
        const invalidShapes = [];
        
        data.shapes.forEach((shape, index) => {
            // Valider que les coordonnées sont présentes
            if (!this.hasValidCoordinates(shape)) {
                console.warn(`⚠️ Forme ${index + 1} (${shape.type}) sans coordonnées valides:`, shape);
                invalidShapes.push({ index: index + 1, type: shape.type });
                return;
            }
            
            const geoJson = this.convertToGeoJSON(shape);
            const centroid = this.calculateCentroid(shape);
            
            const shapeData = {
                name: null, // Sera généré automatiquement par Apex
                areaType: shape.type,
                geoJson: JSON.stringify(geoJson),
                latitude: centroid.latitude,
                longitude: centroid.longitude,
                address: shape.address || null // Adresse depuis la page Visualforce
            };
            
            shapesData.push(shapeData);
            console.log(`✅ Forme ${index + 1} validée:`, shapeData);
        });
        
        // Afficher un avertissement si des formes sont invalides
        if (invalidShapes.length > 0) {
            const warningMessage = `${invalidShapes.length} forme(s) ignorée(s) (coordonnées manquantes)`;
            this.showToast('Avertissement', warningMessage, 'warning');
        }
        
        // Vérifier qu'il reste des formes valides à sauvegarder
        if (shapesData.length === 0) {
            this.showToast('Erreur', 'Aucune forme avec coordonnées valides à sauvegarder', 'error');
            this.isSaving = false;
            return;
        }
        
        // Sauvegarder dans Salesforce
        this.saveToSalesforce(shapesData);
    }
    
    /**
     * Vérifier que la forme a des coordonnées valides
     */
    hasValidCoordinates(shape) {
        // Vérifier que la forme a des coordonnées
        if (!shape.coordinates || shape.coordinates.length === 0) {
            return false;
        }
        
        // Vérifier que les coordonnées ont latitude et longitude
        for (const coord of shape.coordinates) {
            if (typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number' ||
                isNaN(coord.latitude) || isNaN(coord.longitude)) {
                return false;
            }
        }
        
        return true;
    }
    

    
    convertToGeoJSON(shape) {
        let geoJson = {
            type: "Feature",
            properties: {
                originalType: shape.type
            },
            geometry: null
        };
        
        switch (shape.type) {
            case 'Point':
                geoJson.geometry = {
                    type: "Point",
                    coordinates: [shape.coordinates[0].longitude, shape.coordinates[0].latitude]
                };
                break;
                
            case 'Polyline':
                geoJson.geometry = {
                    type: "LineString",
                    coordinates: shape.coordinates.map(coord => [coord.longitude, coord.latitude])
                };
                break;
                
            case 'Polygon':
                // Fermer le polygone si ce n'est pas déjà fait
                let coords = shape.coordinates.map(coord => [coord.longitude, coord.latitude]);
                if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
                    coords.push(coords[0]);
                }
                geoJson.geometry = {
                    type: "Polygon",
                    coordinates: [coords]
                };
                break;
                
            case 'Rectangle':
                // Créer un polygone rectangulaire à partir des coins SW et NE
                const sw = shape.coordinates[0]; // Sud-Ouest
                const ne = shape.coordinates[1]; // Nord-Est
                geoJson.geometry = {
                    type: "Polygon",
                    coordinates: [[
                        [sw.longitude, sw.latitude], // SW
                        [ne.longitude, sw.latitude], // SE
                        [ne.longitude, ne.latitude], // NE
                        [sw.longitude, ne.latitude], // NW
                        [sw.longitude, sw.latitude]  // Fermer le polygone
                    ]]
                };
                geoJson.properties.shapeType = "Rectangle";
                break;
                
            case 'Circle':
                // Pour un cercle, on garde le centre et on ajoute le rayon dans les propriétés
                // Le GeoJSON standard ne supporte pas les cercles, on utilise un Point avec rayon
                geoJson.geometry = {
                    type: "Point",
                    coordinates: [shape.center.longitude, shape.center.latitude]
                };
                geoJson.properties.shapeType = "Circle";
                geoJson.properties.radius = this.calculateCircleRadius(shape);
                break;
                
            case 'Adresse':
                // Pour une adresse, on utilise un Point avec l'adresse dans les propriétés
                geoJson.geometry = {
                    type: "Point",
                    coordinates: [shape.center.longitude, shape.center.latitude]
                };
                geoJson.properties.shapeType = "Adresse";
                geoJson.properties.address = shape.address;
                break;
                
            default:
                console.warn('Type de forme non reconnu:', shape.type);
                geoJson.geometry = {
                    type: "Point",
                    coordinates: [0, 0]
                };
        }
        
        return geoJson;
    }
    
    calculateCentroid(shape) {
        let centroid = { latitude: 0, longitude: 0 };
        
        switch (shape.type) {
            case 'Point':
                centroid = {
                    latitude: shape.coordinates[0].latitude,
                    longitude: shape.coordinates[0].longitude
                };
                break;
                
            case 'Adresse':
                // Pour une adresse, le centroïde est le point central
                centroid = {
                    latitude: shape.center.latitude,
                    longitude: shape.center.longitude
                };
                break;
                
            case 'Polyline':
            case 'Polygon':
                // Calculer la moyenne des coordonnées
                let sumLat = 0, sumLng = 0;
                shape.coordinates.forEach(coord => {
                    sumLat += coord.latitude;
                    sumLng += coord.longitude;
                });
                centroid = {
                    latitude: sumLat / shape.coordinates.length,
                    longitude: sumLng / shape.coordinates.length
                };
                break;
                
            case 'Rectangle':
                // Centre du rectangle = moyenne des coins SW et NE
                const sw = shape.coordinates[0];
                const ne = shape.coordinates[1];
                centroid = {
                    latitude: (sw.latitude + ne.latitude) / 2,
                    longitude: (sw.longitude + ne.longitude) / 2
                };
                break;
                
            case 'Circle':
                // Le centroïde d'un cercle est son centre
                centroid = {
                    latitude: shape.center.latitude,
                    longitude: shape.center.longitude
                };
                break;
                
            default:
                console.warn('Type de forme non reconnu pour le centroïde:', shape.type);
        }
        
        return centroid;
    }
    
    calculateCircleRadius(shape) {
        // Calculer le rayon approximatif en degrés
        const sw = shape.coordinates[0];
        const ne = shape.coordinates[1];
        return Math.abs(ne.latitude - sw.latitude) / 2;
    }
    
    // Méthode pour sauvegarder une adresse sélectionnée
    saveAddressToSalesforce(addressShape) {
        console.log('💾 Sauvegarde de l\'adresse:', addressShape);
        
        try {
            // Convertir l'adresse en format compatible avec Apex
            const geoJson = this.convertToGeoJSON(addressShape);
            const centroid = this.calculateCentroid(addressShape);
            
            const addressData = {
                name: null, // Sera généré automatiquement par Apex
                areaType: 'Point', // Utiliser "Point" temporairement car "Adresse" n'est pas encore dans la picklist
                geoJson: JSON.stringify(geoJson),
                latitude: centroid.latitude,
                longitude: centroid.longitude,
                address: addressShape.address || 'Adresse non trouvée'
            };
            
            console.log('✅ Données d\'adresse préparées:', addressData);
            
            // Sauvegarder dans Salesforce
            this.saveToSalesforce([addressData]);
            
        } catch (error) {
            console.error('❌ Erreur lors de la préparation de l\'adresse:', error);
            this.showToast('Erreur', 'Erreur lors de la préparation de l\'adresse', 'error');
            this.isSaving = false;
        }
    }
    

    
    handleSaveShape() {
        // Activer l'état de chargement
        this.isSaving = true;
        
        // VÉRIFIER SI UNE ADRESSE EST SÉLECTIONNÉE
        if (this.selectedShape && this.selectedShape.isAddress) {
            console.log('📍 Sauvegarde d\'une adresse sélectionnée:', this.selectedShape);
            
            // Traiter directement l'adresse sélectionnée
            this.saveAddressToSalesforce(this.selectedShape);
            return;
        }
        
        // Sinon, demander la forme actuellement sélectionnée à la carte
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'GET_CURRENT_SHAPE'
            }, '*');
        }
    }
    
    async saveToSalesforce(shapesData) {
        try {
            console.log('💾 Sauvegarde des formes:', shapesData);
            
            // Journaliser les données envoyées pour diagnostic
            this.logShapeDataForDiagnostic(shapesData);
            
            const result = await saveMapAreas({ shapesData: shapesData });
            
            console.log('✅ Résultat de sauvegarde:', result);
            
            if (result.success) {
                // Succès - Afficher le toast standard Salesforce
                this.showStandardSuccessToast(result);
                
                // Désélectionner les formes sur la carte
                this.clearMapSelection();
                
                // Log des IDs créés pour inspection
                console.log('🎯 IDs créés:', result.recordIds);
                
            } else {
                // Erreur avec diagnostic amélioré
                this.handleSaveError(result, shapesData);
            }
            
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde:', error);
            this.showToast('Erreur', 'Erreur inattendue lors de la sauvegarde: ' + error.body?.message || error.message, 'error');
        } finally {
            // Réactiver le bouton
            this.isSaving = false;
        }
    }
    
    /**
     * Afficher le toast de succès standard Salesforce
     */
    showStandardSuccessToast(result) {
        // Message avec pluriel correct
        let message;
        if (result.recordsCreated === 1) {
            message = '1 zone de carte a été créée avec succès.';
        } else {
            message = `${result.recordsCreated} zones de carte ont été créées avec succès.`;
        }
        
        // Toast standard Salesforce sans icône
        this.showToast('Succès', message, 'success');
    }
    
    /**
     * Désélectionner toutes les formes sur la carte
     */
    clearMapSelection() {
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'CLEAR_SELECTION'
            }, '*');
        }
        
        // Désactiver le bouton Save Shape
        this._isSaveButtonDisabled = true;
        console.log('🗑️ Sélection de la carte vidée, bouton désactivé');
    }
    

    
    logShapeDataForDiagnostic(shapesData) {
        console.log('🔍 DIAGNOSTIC - Données envoyées:');
        shapesData.forEach((shape, index) => {
            console.log(`  Forme ${index + 1}:`);
            console.log(`    - Type: ${shape.areaType}`);
            console.log(`    - Nom: ${shape.name || 'AUTO'}`);
            console.log(`    - GeoJSON longueur: ${shape.geoJson ? shape.geoJson.length : 0} caractères`);
            console.log(`    - Latitude: ${shape.latitude}`);
            console.log(`    - Longitude: ${shape.longitude}`);
            console.log(`    - Adresse: ${shape.address || 'Non renseignée'}`);
        });
    }
    
    handleSaveError(result, shapesData) {
        // Message principal d'erreur
        let errorMessage = result.message || 'Échec de la sauvegarde';
        
        // Ajouter le premier message d'erreur lisible
        if (result.errorDetails && result.errorDetails.length > 0) {
            const firstError = result.errorDetails[0];
            errorMessage += ` - ${firstError.errorMessage}`;
            
            // Log détaillé des erreurs
            console.error('❌ DIAGNOSTIC DÉTAILLÉ DES ERREURS:');
            result.errorDetails.forEach((errorDetail, index) => {
                console.error(`  Erreur ${index + 1}:`);
                console.error(`    - Message: ${errorDetail.errorMessage}`);
                console.error(`    - Champ: ${errorDetail.fieldName || 'Non spécifié'}`);
                console.error(`    - Validation: ${errorDetail.validation}`);
                console.error(`    - Index forme: ${errorDetail.itemIndex}`);
                
                // Afficher les données de la forme en erreur
                if (errorDetail.itemIndex >= 0 && errorDetail.itemIndex < shapesData.length) {
                    const failedShape = shapesData[errorDetail.itemIndex];
                    console.error(`    - Données de la forme échouée:`);
                    console.error(`      * Type: ${failedShape.areaType}`);
                    console.error(`      * GeoJSON longueur: ${failedShape.geoJson ? failedShape.geoJson.length : 0}`);
                    console.error(`      * Coordonnées: ${failedShape.latitude}, ${failedShape.longitude}`);
                }
            });
        } else if (result.errors && result.errors.length > 0) {
            errorMessage += ` - ${result.errors[0]}`;
        }
        
        this.showToast('Échec de la sauvegarde', errorMessage, 'error');
    }
    
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'dismissible'
        });
        this.dispatchEvent(event);
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