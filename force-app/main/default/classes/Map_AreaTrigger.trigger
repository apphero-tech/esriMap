trigger Map_AreaTrigger on Map_Area__c (after delete, after update) {
    if (Trigger.isAfter && Trigger.isDelete) {
        MapAreaService.handleDeletedSynchronizedMapAreas(Trigger.old);
    }
    
    if (Trigger.isAfter && Trigger.isUpdate) {
        MapAreaService.enforceExclusiveSynchronization(Trigger.new);
    }
}
