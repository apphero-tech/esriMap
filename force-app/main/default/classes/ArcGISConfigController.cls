public with sharing class ArcGISConfigController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getPublicConfig() {
        try {
            // Configuration par défaut
            Map<String, Object> config = new Map<String, Object>{
                'apiKey' => null, // À configurer via Custom Settings
                'defaultBasemap' => 'arcgis-navigation',
                'geocoderUrl' => 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer',
                'sdkVersion' => '4.33',
                'locale' => 'fr-CA'
            };
            
            // TODO: Charger depuis Custom Settings quand disponible
            // ArcGIS_Settings__mdt settings = ArcGIS_Settings__mdt.getInstance('Default');
            // if (settings != null) {
            //     config.put('apiKey', settings.ApiKey__c);
            //     config.put('defaultBasemap', settings.DefaultBasemap__c);
            //     config.put('geocoderUrl', settings.GeocoderUrl__c);
            //     config.put('sdkVersion', settings.SdkVersion__c);
            //     config.put('locale', settings.Locale__c);
            // }
            
            return config;
            
        } catch (Exception e) {
            throw new AuraHandledException('Erreur lors du chargement de la configuration ArcGIS: ' + e.getMessage());
        }
    }
    
    /**
     * Vérifie si la configuration ArcGIS est valide
     * @return Boolean True si la configuration est valide
     */
    @AuraEnabled(cacheable=true)
    public static Boolean isConfigValid() {
        try {
            Map<String, Object> config = getPublicConfig();
            return config != null && 
                   config.containsKey('geocoderUrl') && 
                   config.containsKey('defaultBasemap') && 
                   config.containsKey('sdkVersion');
        } catch (Exception e) {
            System.debug('❌ Erreur lors de la validation de la configuration: ' + e.getMessage());
            return false;
        }
    }
}
