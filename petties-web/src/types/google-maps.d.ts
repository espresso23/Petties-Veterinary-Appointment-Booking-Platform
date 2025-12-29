/**
 * Type definitions for Google Maps Places API (New)
 * PlaceAutocompleteElement types
 * 
 * See: https://developers.google.com/maps/documentation/javascript/place-autocomplete-element
 */

/// <reference types="@types/google.maps" />

declare namespace google.maps.places {
  /**
   * PlaceAutocompleteElement - New API replacing deprecated Autocomplete
   * This is a web component (HTMLElement) that provides autocomplete functionality
   */
  class PlaceAutocompleteElement extends HTMLElement {
    /**
     * The value of the input field
     */
    value: string

    /**
     * The selected place
     */
    selectedPlace?: Place | null

    /**
     * Set attribute (for component restrictions, etc.)
     */
    setAttribute(name: string, value: string): void

    /**
     * Get attribute
     */
    getAttribute(name: string): string | null

    /**
     * Event fired when a place is selected
     * Event type: 'gmp-placeselect'
     */
    addEventListener(
      type: 'gmp-placeselect',
      listener: (event: PlaceSelectEvent) => void,
      options?: boolean | AddEventListenerOptions
    ): void

    /**
     * Event fired when input value changes
     */
    addEventListener(
      type: 'input',
      listener: (event: Event) => void,
      options?: boolean | AddEventListenerOptions
    ): void

    /**
     * Event fired when API has errors (billing, etc.)
     */
    addEventListener(
      type: 'gmp-error',
      listener: (event: Event) => void,
      options?: boolean | AddEventListenerOptions
    ): void

    /**
     * Remove event listener
     */
    removeEventListener(
      type: 'gmp-placeselect' | 'input' | 'gmp-error',
      listener: EventListener,
      options?: boolean | EventListenerOptions
    ): void
  }

  /**
   * Place object from PlaceAutocompleteElement
   */
  interface Place {
    /**
     * Formatted address
     */
    formattedAddress?: string

    /**
     * Display name
     */
    displayName?: string

    /**
     * Name
     */
    name?: string

    /**
     * Location coordinates
     * Can be either LatLng object (with lat/lng methods) or plain object (with lat/lng properties)
     */
    location?: {
      lat(): number
      lng(): number
      lat?: number
      lng?: number
    } | {
      lat: number
      lng: number
    }

    /**
     * Geometry (legacy format support)
     */
    geometry?: {
      location?: {
        lat(): number
        lng(): number
        lat?: number
        lng?: number
      }
    }

    /**
     * Place ID
     */
    id?: string
  }

  /**
   * Event fired when a place is selected
   */
  interface PlaceSelectEvent extends Event {
    place: Place
  }
}

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google: typeof google
  }
}

export { }
