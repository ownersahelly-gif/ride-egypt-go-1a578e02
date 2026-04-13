

# Global Map — Transportation Operations System

## Summary
Build a full-screen, admin-only map operations page (`/admin/global-map`) accessible via a "Global Map" button on the Route Request page. This system visualizes all route requests on an interactive Google Map with filtering, area selection, manual route building, and route generation capabilities.

## Data Source
All data comes from the existing `route_requests` table joined with `profiles` for user info (name, phone). The table already has: origin/destination coords+names, preferred_time, preferred_days, user_id, status.

## Implementation Plan

### Step 1: Create the GlobalMap page (`src/pages/GlobalMap.tsx`)
A large, complex page with these sections:

**Top toolbar:**
- Back button to admin/route-requests
- Filter controls (time range, days, area preset dropdown)
- Toggle buttons: Show Lines, Show Clusters
- "Generate Route" button
- "Show Connected Routes" / "Hide Routes" toggle

**Full-screen Google Map (main area):**
- Uses `@react-google-maps/api` (already installed)
- Pickup markers (green) and dropoff markers (red) for each route request
- InfoWindow on click showing: name, phone, pickup, dropoff, time, days
- Smart deduplication: group by user_id + similar origin/dest coords, merge days

**Left sidebar (collapsible):**
- User list with filters applied
- Hidden users list
- Route builder panel (start, end, stops, assigned users)

### Step 2: Smart Deduplication Logic
- Group route_requests by user_id + origin/destination proximity (within ~200m)
- Merge preferred_days arrays
- Display single marker pair per unique user-route

### Step 3: Filtering System
- Time range picker (two time inputs)
- Day-of-week checkboxes
- Area presets (New Cairo, Maadi, Smart Village, etc.) with configurable radius
- Radius slider (1-20km, default 5km)
- Filter applies to both pickup and dropoff independently

### Step 4: Area Selection Tools
- Drawing manager integration (circle + polygon)
- Actions on selected area: show/hide users, use as pickup/dropoff filter
- Multiple zone support with color coding

### Step 5: Map Visualization Controls
- Toggle pickup→dropoff dashed lines
- MarkerClusterer for zoom-out clustering
- Expand details on zoom-in

### Step 6: Manual Route Builder
- Click map to set start/end points
- Add stops by clicking map or dragging
- Stops are draggable, reorderable via sidebar list
- Show nearby users per stop (within configurable radius)
- Manual user assignment to stops

### Step 7: Hide/Exclude Control
- Select users or draw area → "Hide" button
- Hidden users stored in component state
- Hidden users excluded from all operations and visualization

### Step 8: Smart Route Generation
- Select start + end → "Generate Route"
- Use Google Directions API with waypoints (visible users' pickups/dropoffs)
- Optimize waypoint order (`optimizeWaypoints: true`)
- Filter users near the generated path only
- Show total distance + ETA
- Snap stops to real road points

### Step 9: Global Route Visualization
- "Show Connected Routes": draw Directions API routes for all visible users (pickup→dropoff)
- "Hide Routes": clear all route polylines, keep markers

### Step 10: Save Route
- Save generated route to the existing `routes` table + `stops` table
- Include start, end, ordered stops, assigned users, time, distance, ETA
- Navigate to route management after save

### Step 11: Wire up routing
- Add `/admin/global-map` route in `App.tsx` (protected)
- Add "Global Map" button at top of Route Request page and in admin route_requests tab

## Technical Details

**New files:**
- `src/pages/GlobalMap.tsx` — main page (~800-1200 lines)
- `src/components/global-map/MapToolbar.tsx` — filter bar
- `src/components/global-map/UserSidebar.tsx` — user list + route builder
- `src/components/global-map/RouteBuilder.tsx` — stop management panel

**Dependencies:** Uses existing `@react-google-maps/api`. Will add `@googlemaps/markerclusterer` for clustering.

**Google Maps APIs used:**
- Maps JavaScript API (already configured)
- Directions API (already used in MapView)
- Drawing Manager (circles/polygons)
- Geometry library (distance calculations)

**No database changes needed** — reads from existing `route_requests`, `profiles`, `routes`, `stops` tables.

## Phased Delivery
Given the scope, this will be built incrementally:
1. Base map with all route request markers + info windows + deduplication
2. Filtering (time, days, area) + hide/exclude
3. Area selection tools (drawing)
4. Manual route builder + user assignment
5. Route generation with Directions API + save

