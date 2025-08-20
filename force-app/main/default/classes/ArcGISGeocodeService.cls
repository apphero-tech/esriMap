public with sharing class ArcGISGeocodeService {
    
    /**
     * Méthode pour géocoder des coordonnées en adresse
     * @param latitude Latitude du point
     * @param longitude Longitude du point
     * @return Adresse formatée ou message d'erreur
     */
    @AuraEnabled
    public static String reverseGeocode(Decimal latitude, Decimal longitude) {
        try {
            System.debug('🌍 Début géocodage inverse pour: ' + latitude + ', ' + longitude);
            
            // Validation des paramètres
            if (latitude == null || longitude == null) {
                throw new CalloutException('Coordonnées invalides');
            }
            
            // Construction de l'URL directe (ArcGIS public)
            String endpoint = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
            String params = '?location=' + longitude + ',' + latitude + 
                           '&outSR=4326&returnIntersection=false&f=json';
            String fullUrl = endpoint + params;
            
            System.debug('🔗 URL appelée: ' + fullUrl);
            
            // Appel HTTP
            Http http = new Http();
            HttpRequest request = new HttpRequest();
            request.setEndpoint(fullUrl);
            request.setMethod('GET');
            request.setTimeout(10000); // 10 secondes
            
            HttpResponse response = http.send(request);
            System.debug('📡 Status Code: ' + response.getStatusCode());
            System.debug('📡 Response Body: ' + response.getBody());
            
            if (response.getStatusCode() == 200) {
                // Parser la réponse JSON
                Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                
                if (jsonResponse.containsKey('address')) {
                    Map<String, Object> address = (Map<String, Object>) jsonResponse.get('address');
                    String formattedAddress = formatAddress(address);
                    System.debug('✅ Adresse trouvée: ' + formattedAddress);
                    return formattedAddress;
                } else if (jsonResponse.containsKey('error')) {
                    Map<String, Object> error = (Map<String, Object>) jsonResponse.get('error');
                    String errorMessage = (String) error.get('message');
                    System.debug('❌ Erreur API ArcGIS: ' + errorMessage);
                    throw new CalloutException('Erreur géocodage: ' + errorMessage);
                } else {
                    System.debug('⚠️ Aucune adresse trouvée');
                    return 'Adresse non trouvée pour ces coordonnées';
                }
            } else {
                System.debug('❌ Erreur HTTP: ' + response.getStatusCode() + ' - ' + response.getBody());
                throw new CalloutException('Erreur de communication avec le service de géocodage');
            }
            
        } catch (Exception e) {
            System.debug('💥 Exception dans reverseGeocode: ' + e.getMessage());
            System.debug('💥 Stack trace: ' + e.getStackTraceString());
            throw new CalloutException('Erreur lors du géocodage: ' + e.getMessage());
        }
    }
    
    /**
     * Formate l'adresse à partir de la réponse ArcGIS
     * @param address Map contenant les éléments d'adresse
     * @return Adresse formatée
     */
    private static String formatAddress(Map<String, Object> address) {
        List<String> addressParts = new List<String>();
        
        // Numéro et rue
        String streetNumber = (String) address.get('Addr_type');
        String street = (String) address.get('Address');
        if (String.isNotBlank(street)) {
            addressParts.add(street);
        }
        
        // Ville
        String city = (String) address.get('City');
        if (String.isNotBlank(city)) {
            addressParts.add(city);
        }
        
        // Région/État
        String region = (String) address.get('Region');
        if (String.isNotBlank(region)) {
            addressParts.add(region);
        }
        
        // Code postal
        String postalCode = (String) address.get('Postal');
        if (String.isNotBlank(postalCode)) {
            addressParts.add(postalCode);
        }
        
        // Pays
        String country = (String) address.get('CountryCode');
        if (String.isNotBlank(country)) {
            addressParts.add(country);
        }
        
        String formattedAddress = String.join(addressParts, ', ');
        
        // Si aucun élément n'est trouvé, utiliser LongLabel comme fallback
        if (String.isBlank(formattedAddress)) {
            formattedAddress = (String) address.get('LongLabel');
        }
        
        return String.isNotBlank(formattedAddress) ? formattedAddress : 'Adresse non disponible';
    }
}
