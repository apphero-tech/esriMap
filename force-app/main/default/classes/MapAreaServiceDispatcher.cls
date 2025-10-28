/**
 * MapAreaServiceDispatcher - Intelligent dispatcher for Map_Area__c creation
 * 
 * Automatically detects if the user is a guest user (Community) or internal user
 * and calls the appropriate service (MapAreaServiceGuest or MapAreaService).
 * 
 * This class uses "without sharing" to ensure guest users can create Map_Area__c
 * even when they don't have direct permissions.
 */
public without sharing class MapAreaServiceDispatcher {
    
    /**
     * Wrapper class for the response (reused from MapAreaService)
     */
    public class SaveResult {
        @AuraEnabled
        public Boolean success { get; set; }
        @AuraEnabled
        public String message { get; set; }
        @AuraEnabled
        public List<String> recordIds { get; set; }
        @AuraEnabled
        public Integer recordsCreated { get; set; }
        @AuraEnabled
        public List<String> errors { get; set; }
        @AuraEnabled
        public List<ErrorDetail> errorDetails { get; set; }
        
        public SaveResult() {
            this.recordIds = new List<String>();
            this.errors = new List<String>();
            this.errorDetails = new List<ErrorDetail>();
            this.recordsCreated = 0;
        }
    }
    
    /**
     * Error detail wrapper
     */
    public class ErrorDetail {
        @AuraEnabled
        public String message { get; set; }
        @AuraEnabled
        public String field { get; set; }
        @AuraEnabled
        public String errorType { get; set; }
        @AuraEnabled
        public Integer index { get; set; }
        
        public ErrorDetail(String message, String field, String errorType, Integer index) {
            this.message = message;
            this.field = field;
            this.errorType = errorType;
            this.index = index;
        }
    }
    
    /**
     * Shape data wrapper (reused from MapAreaService)
     */
    public class ShapeData {
        @AuraEnabled
        public String name { get; set; }
        @AuraEnabled
        public String areaType { get; set; }
        @AuraEnabled
        public String geoJson { get; set; }
        @AuraEnabled
        public Decimal latitude { get; set; }
        @AuraEnabled
        public Decimal longitude { get; set; }
        @AuraEnabled
        public String address { get; set; }
    }
    
    /**
     * Main dispatcher method - intelligently routes to the right service
     */
    @AuraEnabled
    public static SaveResult saveMapAreas(List<ShapeData> shapesData, String parentRecordId, String relationshipFieldName) {
        SaveResult result = new SaveResult();
        
        try {
            // Detect if user is guest
            Boolean isGuestUser = detectGuestUser();
            
            System.debug('🔍 User type detected: ' + (isGuestUser ? 'GUEST' : 'INTERNAL'));
            
            // Convert ShapeData to MapAreaService.ShapeData
            List<MapAreaService.ShapeData> convertedShapes = new List<MapAreaService.ShapeData>();
            for (ShapeData shape : shapesData) {
                MapAreaService.ShapeData serviceShape = new MapAreaService.ShapeData();
                serviceShape.name = shape.name;
                serviceShape.areaType = shape.areaType;
                serviceShape.geoJson = shape.geoJson;
                serviceShape.latitude = shape.latitude;
                serviceShape.longitude = shape.longitude;
                serviceShape.address = shape.address;
                convertedShapes.add(serviceShape);
            }
            
            if (isGuestUser) {
                // ✅ Route to MapAreaServiceGuest (without sharing)
                System.debug('🔓 Routing to MapAreaServiceGuest');
                
                // Convert to MapAreaServiceGuest.ShapeData
                List<MapAreaServiceGuest.ShapeData> guestShapes = new List<MapAreaServiceGuest.ShapeData>();
                for (MapAreaService.ShapeData serviceShape : convertedShapes) {
                    MapAreaServiceGuest.ShapeData guestShape = new MapAreaServiceGuest.ShapeData();
                    guestShape.name = serviceShape.name;
                    guestShape.areaType = serviceShape.areaType;
                    guestShape.geoJson = serviceShape.geoJson;
                    guestShape.latitude = serviceShape.latitude;
                    guestShape.longitude = serviceShape.longitude;
                    guestShape.address = serviceShape.address;
                    guestShapes.add(guestShape);
                }
                
                return MapAreaServiceGuest.saveShapesForGuest(guestShapes, parentRecordId, relationshipFieldName);
            } else {
                // ✅ Route to MapAreaService (with sharing)
                System.debug('🔐 Routing to MapAreaService');
                return MapAreaService.saveMapAreas(convertedShapes, parentRecordId, relationshipFieldName);
            }
            
        } catch (Exception e) {
            result.success = false;
            result.message = 'Erreur inattendue: ' + e.getMessage();
            System.debug('❌ Dispatcher error: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
        }
        
        return result;
    }
    
    /**
     * Detect if current user is a guest user (Community)
     * 
     * Multiple detection methods:
     * 1. Check UserType field in User object
     * 2. Check if user has "guest" profile
     * 3. Check if running in guest context
     */
    private static Boolean detectGuestUser() {
        try {
            // Get current user ID
            String userId = UserInfo.getUserId();
            
            if (String.isBlank(userId)) {
                System.debug('⚠️ No user ID available');
                return false;
            }
            
            // Query user to check UserType
            User currentUser = [
                SELECT Id, UserType, Profile.Name 
                FROM User 
                WHERE Id = :userId 
                LIMIT 1
            ];
            
            // Check UserType
            // Possible values: 'Standard', 'CommunityUser', 'CSPLitePortal', 'PowerCustomerSuccess', 'CustomerSuccess'
            Boolean isCommunityUser = currentUser.UserType != null && 
                                     (currentUser.UserType == 'CommunityUser' || 
                                      currentUser.UserType == 'CSPLitePortal' ||
                                      currentUser.UserType == 'PowerCustomerSuccess' ||
                                      currentUser.UserType == 'CustomerSuccess');
            
            System.debug('👤 User: ' + currentUser.Id);
            System.debug('📊 UserType: ' + currentUser.UserType);
            System.debug('👮 Profile: ' + currentUser.Profile.Name);
            System.debug('🎭 Is Community User: ' + isCommunityUser);
            
            return isCommunityUser;
            
        } catch (Exception e) {
            System.debug('⚠️ Error detecting user type: ' + e.getMessage());
            // Default to internal user if detection fails
            return false;
        }
    }
}
