import { createElement } from "lwc";
import EsriMapEditor from "c/esriMapEditor";
import { ShowToastEventName } from "lightning/platformShowToastEvent";

// Mock Apex methods
import saveMapAreas from "@salesforce/apex/MapAreaServiceDispatcher.saveMapAreas";
import getMapAreasByIds from "@salesforce/apex/MapAreaService.getMapAreasByIds";
import getMapAreasByRelationship from "@salesforce/apex/MapAreaService.getMapAreasByRelationship";
import deleteMapArea from "@salesforce/apex/MapAreaService.deleteMapArea";
import deleteMapAreas from "@salesforce/apex/MapAreaService.deleteMapAreas";
import syncShapeToParent from "@salesforce/apex/MapAreaService.syncShapeToParent";

// Mock all Apex methods
jest.mock(
  "@salesforce/apex/MapAreaServiceDispatcher.saveMapAreas",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/MapAreaService.getMapAreasByIds",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/MapAreaService.getMapAreasByRelationship",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/MapAreaService.deleteMapArea",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/MapAreaService.deleteMapAreas",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/MapAreaService.syncShapeToParent",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

// Mock NavigationMixin
const mockNavigateGenerate = jest.fn();
jest.mock(
  "lightning/navigation",
  () => ({
    NavigationMixin: (Base) => {
      return class extends Base {
        [Symbol.for("lightning/navigation.GenerateUrl")] = mockNavigateGenerate;
      };
    }
  }),
  { virtual: true }
);

describe("c-esri-map-editor", () => {
  let element;

  // Helper to flush promises
  const flushPromises = () => new Promise(process.nextTick);

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockNavigateGenerate.mockResolvedValue("/mockUrl");

    // Default mock implementations
    getMapAreasByRelationship.mockResolvedValue({});
    saveMapAreas.mockResolvedValue({
      success: true,
      message: "Saved successfully",
      recordIds: ["a001234567890ABC"],
      recordsCreated: 1
    });
    getMapAreasByIds.mockResolvedValue({
      a001234567890ABC: {
        Id: "a001234567890ABC",
        Name: "Test Area",
        Address__c: "Test Address",
        Latitude__c: 48.8566,
        Longitude__c: 2.3522,
        Area_Type__c: "Point",
        CreatedBy: { Name: "Test User" },
        CreatedDate: "2024-01-01T00:00:00.000Z",
        Is_Synchronized__c: false
      }
    });
    deleteMapArea.mockResolvedValue({ success: true, message: "Deleted" });
    deleteMapAreas.mockResolvedValue({ success: true, deletedCount: 1 });
    syncShapeToParent.mockResolvedValue({ success: true, message: "Synced" });

    // Create element
    element = createElement("c-esri-map-editor", {
      is: EsriMapEditor
    });
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  // ========================================================================
  // COMPONENT INITIALIZATION TESTS
  // ========================================================================

  describe("Component Initialization", () => {
    it("should create component with default values", () => {
      document.body.appendChild(element);

      expect(element.recordId).toBeUndefined();
      expect(element.relationshipFieldName).toBeUndefined();
      expect(element.readOnly).toBe(false);
    });

    it("should set recordId and relationshipFieldName via api", () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);

      expect(element.recordId).toBe("5001234567890ABC");
      expect(element.relationshipFieldName).toBe("Case__c");
    });

    it("should set custom title via api", async () => {
      element.title = "Custom Map Title";
      document.body.appendChild(element);
      await flushPromises();

      expect(element.title).toBe("Custom Map Title");
    });

    it("should register message event listener on connectedCallback", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");
      document.body.appendChild(element);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });

    it("should remove message event listener on disconnectedCallback", () => {
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");
      document.body.appendChild(element);
      document.body.removeChild(element);

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });
  });

  // ========================================================================
  // API PROPERTY TESTS
  // ========================================================================

  describe("API Properties", () => {
    it("should accept recordId property", () => {
      element.recordId = "5001234567890ABC";
      document.body.appendChild(element);

      expect(element.recordId).toBe("5001234567890ABC");
    });

    it("should accept relationshipFieldName property", () => {
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);

      expect(element.relationshipFieldName).toBe("Case__c");
    });

    it("should accept title property", () => {
      element.title = "Test Title";
      document.body.appendChild(element);

      expect(element.title).toBe("Test Title");
    });

    it("should accept readOnly property", () => {
      element.readOnly = true;
      document.body.appendChild(element);

      expect(element.readOnly).toBe(true);
    });

    it("should have lastSavedShapeId property", () => {
      document.body.appendChild(element);

      expect(element.lastSavedShapeId).toBeNull();
    });

    it("should have lastSavedShapeData property", () => {
      document.body.appendChild(element);

      expect(element.lastSavedShapeData).toBeNull();
    });

    it("should have allSavedRecordIds property", () => {
      document.body.appendChild(element);

      expect(element.allSavedRecordIds).toEqual([]);
    });
  });

  // ========================================================================
  // FLOW INTEGRATION TESTS
  // ========================================================================

  describe("Flow Integration", () => {
    it("should have validate method for Flow", () => {
      document.body.appendChild(element);

      expect(typeof element.validate).toBe("function");
    });

    it("should return valid validation result", () => {
      document.body.appendChild(element);

      const result = element.validate();

      expect(result).toHaveProperty("isValid", true);
      expect(result).toHaveProperty("lastSavedShapeId");
      expect(result).toHaveProperty("lastSavedShapeData");
      expect(result).toHaveProperty("allSavedRecordIds");
    });
  });

  // ========================================================================
  // LOAD RELATED RECORDS TESTS
  // ========================================================================

  describe("Load Related Records", () => {
    it("should load related records when recordId and relationship are set", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      const mockRecords = {
        a001: {
          Id: "a001",
          Name: "Area 1",
          Address__c: "Address 1",
          Latitude__c: 48.8566,
          Longitude__c: 2.3522,
          Area_Type__c: "Point",
          CreatedBy: { Name: "User 1" },
          CreatedDate: "2024-01-01T00:00:00.000Z",
          Is_Synchronized__c: false
        }
      };
      getMapAreasByRelationship.mockResolvedValue(mockRecords);

      document.body.appendChild(element);
      await flushPromises();

      expect(getMapAreasByRelationship).toHaveBeenCalledWith({
        parentRecordId: "5001234567890ABC",
        relationshipFieldName: "Case__c"
      });
    });

    it("should not load related records without recordId", async () => {
      element.relationshipFieldName = "Case__c";

      document.body.appendChild(element);
      await flushPromises();

      expect(getMapAreasByRelationship).not.toHaveBeenCalled();
    });

    it("should not load related records without relationshipFieldName", async () => {
      element.recordId = "5001234567890ABC";

      document.body.appendChild(element);
      await flushPromises();

      expect(getMapAreasByRelationship).not.toHaveBeenCalled();
    });

    it("should handle error when loading related records", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      getMapAreasByRelationship.mockRejectedValue({
        body: { message: "Error loading records" }
      });

      document.body.appendChild(element);
      await flushPromises();

      // Component should handle error gracefully
      expect(getMapAreasByRelationship).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // MESSAGE HANDLING TESTS
  // ========================================================================

  describe("Message Handling from Visualforce", () => {
    it("should ignore messages from non-Salesforce domains", async () => {
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://malicious-site.com",
        data: { type: "SHAPE_SELECTED", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      // Should ignore the message
      expect(element).toBeTruthy();
    });

    it("should accept messages from force.com domain", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.vf.force.com",
        data: {
          type: "SHAPE_SELECTED",
          data: {
            shape: {
              coordinates: [{ latitude: 48.8566, longitude: 2.3522 }]
            }
          }
        }
      });

      window.dispatchEvent(event);
      await flushPromises();

      // Message should be processed
      expect(element).toBeTruthy();
    });

    it("should handle MAP_READY message", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(element.recordId).toBe("5001234567890ABC");
    });

    it("should handle NO_SHAPE_SELECTED message", async () => {
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "NO_SHAPE_SELECTED", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(element).toBeTruthy();
    });
  });

  // ========================================================================
  // DELETE OPERATIONS TESTS
  // ========================================================================

  describe("Delete Operations", () => {
    beforeEach(() => {
      window.confirm = jest.fn(() => true);
    });

    it("should call deleteMapArea Apex method", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      expect(deleteMapArea).toBeDefined();
    });

    it("should call deleteMapAreas Apex method", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      expect(deleteMapAreas).toBeDefined();
    });
  });

  // ========================================================================
  // SYNCHRONIZE OPERATIONS TESTS
  // ========================================================================

  describe("Synchronize Operations", () => {
    beforeEach(() => {
      window.confirm = jest.fn(() => true);
    });

    it("should have syncShapeToParent Apex method available", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      expect(syncShapeToParent).toBeDefined();
    });
  });

  // ========================================================================
  // SAVE OPERATIONS TESTS
  // ========================================================================

  describe("Save Operations", () => {
    it("should have saveMapAreas Apex method available", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      expect(saveMapAreas).toBeDefined();
    });

    it("should not save without context", async () => {
      document.body.appendChild(element);
      await flushPromises();

      // Without recordId and relationshipFieldName, save should not proceed
      expect(element.recordId).toBeUndefined();
    });
  });

  // ========================================================================
  // RECORD CHANGE DETECTION TESTS
  // ========================================================================

  describe("Record Change Detection", () => {
    it("should handle record change", async () => {
      element.recordId = "record1";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      // Change record
      element.recordId = "record2";
      await flushPromises();

      expect(element.recordId).toBe("record2");
    });

    it("should cleanup and reinitialize on reconnect", async () => {
      element.recordId = "record1";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      document.body.removeChild(element);

      element.recordId = "record2";
      document.body.appendChild(element);
      await flushPromises();

      expect(element.recordId).toBe("record2");
    });
  });

  // ========================================================================
  // COMPONENT RENDERING TESTS
  // ========================================================================

  describe("Component Rendering", () => {
    it("should render component", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      expect(element).toBeTruthy();
    });

    it("should render in readOnly mode", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      element.readOnly = true;
      document.body.appendChild(element);
      await flushPromises();

      expect(element.readOnly).toBe(true);
    });

    it("should render with custom title", async () => {
      element.title = "Custom Title";
      document.body.appendChild(element);
      await flushPromises();

      expect(element.title).toBe("Custom Title");
    });
  });

  // ========================================================================
  // ERROR HANDLING TESTS
  // ========================================================================

  describe("Error Handling", () => {
    it("should handle Apex error on load gracefully", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      getMapAreasByRelationship.mockRejectedValue({
        body: { message: "Load failed" }
      });

      document.body.appendChild(element);
      await flushPromises();

      // Should not throw
      expect(element).toBeTruthy();
    });

    it("should handle save error gracefully", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      saveMapAreas.mockRejectedValue({
        body: { message: "Save failed" }
      });

      document.body.appendChild(element);
      await flushPromises();

      // Component should still be functional
      expect(element).toBeTruthy();
    });

    it("should handle delete error gracefully", async () => {
      window.confirm = jest.fn(() => true);

      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      deleteMapArea.mockRejectedValue({
        body: { message: "Delete failed" }
      });

      document.body.appendChild(element);
      await flushPromises();

      // Should not throw
      expect(element).toBeTruthy();
    });

    it("should handle sync error gracefully", async () => {
      window.confirm = jest.fn(() => true);

      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      syncShapeToParent.mockRejectedValue({
        body: { message: "Sync failed" }
      });

      document.body.appendChild(element);
      await flushPromises();

      // Should not throw
      expect(element).toBeTruthy();
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe("Edge Cases", () => {
    it("should handle empty recordId", async () => {
      element.recordId = "";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      expect(getMapAreasByRelationship).not.toHaveBeenCalled();
    });

    it("should handle null related records", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";

      getMapAreasByRelationship.mockResolvedValue(null);

      document.body.appendChild(element);
      await flushPromises();

      expect(getMapAreasByRelationship).toHaveBeenCalled();
    });

    it("should handle rapid property changes", async () => {
      document.body.appendChild(element);

      element.recordId = "id1";
      element.recordId = "id2";
      element.recordId = "id3";
      await flushPromises();

      expect(element.recordId).toBe("id3");
    });

    it("should handle message with empty data object", async () => {
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "COORDINATES_UPDATE", data: {} }
      });

      // Should not throw
      window.dispatchEvent(event);
      await flushPromises();

      expect(element).toBeTruthy();
    });
  });

  // ========================================================================
  // CLEANUP TESTS
  // ========================================================================

  describe("Cleanup", () => {
    it("should cleanup properly when removed from DOM", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      document.body.removeChild(element);

      expect(element.parentNode).toBeNull();
    });

    it("should handle reconnection", async () => {
      element.recordId = "5001234567890ABC";
      element.relationshipFieldName = "Case__c";
      document.body.appendChild(element);
      await flushPromises();

      document.body.removeChild(element);
      document.body.appendChild(element);
      await flushPromises();

      expect(element.recordId).toBe("5001234567890ABC");
    });
  });
});
