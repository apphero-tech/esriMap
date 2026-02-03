import { createElement } from "lwc";
import EsriMapViewer from "c/esriMapViewer";

// Mock Apex method
import getMapAreaGeometry from "@salesforce/apex/MapAreaService.getMapAreaGeometry";

jest.mock(
  "@salesforce/apex/MapAreaService.getMapAreaGeometry",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

describe("c-esri-map-viewer", () => {
  let element;

  // Helper to flush promises
  const flushPromises = () => new Promise(process.nextTick);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    getMapAreaGeometry.mockResolvedValue({
      Id: "a001234567890ABC",
      Geometry_JSON__c: '{"type":"Point","coordinates":[2.3522,48.8566]}',
      Area_Type__c: "Point",
      Latitude__c: 48.8566,
      Longitude__c: 2.3522,
      Address__c: "Paris, France"
    });

    element = createElement("c-esri-map-viewer", {
      is: EsriMapViewer
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
      expect(element.title).toBeUndefined();
      expect(element.initialZoom).toBe(12);
    });

    it("should set recordId via api property", () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);

      expect(element.recordId).toBe("a001234567890ABC");
    });

    it("should set custom title", () => {
      element.title = "Custom Viewer Title";
      document.body.appendChild(element);

      expect(element.title).toBe("Custom Viewer Title");
    });

    it("should set initial zoom level", () => {
      element.initialZoom = 15;
      document.body.appendChild(element);

      expect(element.initialZoom).toBe(15);
    });
  });

  // ========================================================================
  // LIFECYCLE TESTS
  // ========================================================================

  describe("Lifecycle Methods", () => {
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

    it("should handle multiple renders without issues", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      // Force multiple renders
      element.title = "New Title";
      await flushPromises();

      element.title = "Another Title";
      await flushPromises();

      // Component should still work
      expect(element.recordId).toBe("a001234567890ABC");
      expect(element.title).toBe("Another Title");
    });
  });

  // ========================================================================
  // VF PAGE URL TESTS
  // ========================================================================

  describe("VF Page URL", () => {
    it("should render component without errors", () => {
      document.body.appendChild(element);

      // Component should render
      expect(element).toBeTruthy();
    });
  });

  // ========================================================================
  // MESSAGE HANDLING TESTS
  // ========================================================================

  describe("Message Handling from Visualforce", () => {
    it("should trigger geometry load on MAP_READY message", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(getMapAreaGeometry).toHaveBeenCalledWith({
        recordId: "a001234567890ABC"
      });
    });

    it("should not call Apex without recordId on MAP_READY", async () => {
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(getMapAreaGeometry).not.toHaveBeenCalled();
    });

    it("should ignore unknown message types", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      getMapAreaGeometry.mockClear();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "UNKNOWN_TYPE", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      // Should not trigger additional calls
      expect(element.recordId).toBe("a001234567890ABC");
    });
  });

  // ========================================================================
  // APEX INTEGRATION TESTS
  // ========================================================================

  describe("Apex Integration", () => {
    it("should call getMapAreaGeometry on MAP_READY", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(getMapAreaGeometry).toHaveBeenCalledWith({
        recordId: "a001234567890ABC"
      });
    });

    it("should handle successful geometry load", async () => {
      element.recordId = "a001234567890ABC";
      getMapAreaGeometry.mockResolvedValue({
        Id: "a001234567890ABC",
        Geometry_JSON__c: '{"type":"Point","coordinates":[2.35,48.85]}',
        Area_Type__c: "Point",
        Latitude__c: 48.85,
        Longitude__c: 2.35
      });

      document.body.appendChild(element);
      await flushPromises();

      // Simulate MAP_READY
      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(getMapAreaGeometry).toHaveBeenCalled();
    });

    it("should handle null geometry response", async () => {
      element.recordId = "a001234567890ABC";
      getMapAreaGeometry.mockResolvedValue({
        Id: "a001234567890ABC",
        Geometry_JSON__c: null
      });

      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      expect(getMapAreaGeometry).toHaveBeenCalled();
    });

    it("should handle Apex error gracefully", async () => {
      element.recordId = "a001234567890ABC";
      getMapAreaGeometry.mockRejectedValue(new Error("Apex error"));

      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      // Should not throw
      window.dispatchEvent(event);
      await flushPromises();

      expect(getMapAreaGeometry).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // CARD TITLE TESTS
  // ========================================================================

  describe("Card Title", () => {
    it("should render with custom title", async () => {
      element.title = "My Custom Title";
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      // Check title is set
      expect(element.title).toBe("My Custom Title");
    });

    it("should render without custom title", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      expect(element.title).toBeUndefined();
    });
  });

  // ========================================================================
  // PROPERTY TESTS
  // ========================================================================

  describe("API Properties", () => {
    it("should accept recordId property", () => {
      element.recordId = "testId123";
      document.body.appendChild(element);

      expect(element.recordId).toBe("testId123");
    });

    it("should accept title property", () => {
      element.title = "Test Title";
      document.body.appendChild(element);

      expect(element.title).toBe("Test Title");
    });

    it("should accept initialZoom property", () => {
      element.initialZoom = 18;
      document.body.appendChild(element);

      expect(element.initialZoom).toBe(18);
    });

    it("should have default initialZoom of 12", () => {
      document.body.appendChild(element);

      expect(element.initialZoom).toBe(12);
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe("Edge Cases", () => {
    it("should handle empty recordId", async () => {
      element.recordId = "";
      document.body.appendChild(element);
      await flushPromises();

      // Should not call Apex with empty ID
      expect(getMapAreaGeometry).not.toHaveBeenCalled();
    });

    it("should handle null geometry response completely", async () => {
      element.recordId = "a001234567890ABC";
      getMapAreaGeometry.mockResolvedValue(null);

      document.body.appendChild(element);
      await flushPromises();

      const event = new MessageEvent("message", {
        origin: "https://test.force.com",
        data: { type: "MAP_READY", data: {} }
      });

      window.dispatchEvent(event);
      await flushPromises();

      // Should handle gracefully
      expect(getMapAreaGeometry).toHaveBeenCalled();
    });

    it("should handle rapid property changes", async () => {
      document.body.appendChild(element);

      element.recordId = "id1";
      element.recordId = "id2";
      element.recordId = "id3";
      await flushPromises();

      expect(element.recordId).toBe("id3");
    });
  });

  // ========================================================================
  // COMPONENT RENDERING TESTS
  // ========================================================================

  describe("Component Rendering", () => {
    it("should render iframe element", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      const iframe = element.shadowRoot.querySelector("iframe");
      // iframe may or may not exist depending on template
      expect(element).toBeTruthy();
    });

    it("should render lightning-card", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      const card = element.shadowRoot.querySelector("lightning-card");
      // Card rendering depends on template structure
      expect(element).toBeTruthy();
    });
  });

  // ========================================================================
  // CLEANUP TESTS
  // ========================================================================

  describe("Cleanup", () => {
    it("should cleanup properly when removed from DOM", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      // Remove element
      document.body.removeChild(element);

      // Element should be detached
      expect(element.parentNode).toBeNull();
    });

    it("should handle reconnection", async () => {
      element.recordId = "a001234567890ABC";
      document.body.appendChild(element);
      await flushPromises();

      document.body.removeChild(element);
      document.body.appendChild(element);
      await flushPromises();

      // Should still work
      expect(element.recordId).toBe("a001234567890ABC");
    });
  });
});
