Offline-First Tactical Mapping System — PRD
Project Name

Atlas Offline

1. Overview

Atlas Offline is an offline-first cross-platform tactical mapping application built using React Native and Web technologies. The system allows users to explore maps online and retain previously viewed regions permanently for offline access with identical zoom levels and rendering quality.

The application focuses on:

offline map persistence
efficient vector tile storage
military-style field usability
bandwidth optimization
scalable spatial data architecture

The MVP targets:

Delhi region only
vector tile rendering
offline persistence
predictive prefetching
tile deduplication

Platforms:

Android
iOS
Web
2. Problem Statement

Field operators may lose network access while operating in remote or hostile environments. Traditional online map systems fail under such conditions.

The system must ensure:

“Once a user has viewed a region at a specific zoom level, that region should remain accessible offline forever with the same clarity and zoom quality.”

The application must:

cache viewed map tiles permanently
render maps fully offline
minimize storage and network usage
scale efficiently for larger geographic regions in the future
3. Goals
Primary Goals
Offline-first mapping
Persistent tile storage
Cross-platform support
Efficient storage architecture
Smooth rendering on mobile devices
Secondary Goals
Reduce bandwidth usage
Reduce storage duplication
Predictively cache nearby regions
Enable future tactical overlays
4. Non-Goals (MVP)

The MVP will NOT include:

live navigation
routing
satellite imagery
terrain rendering
real-time collaboration
military coordinate systems (MGRS/UTM)
drone telemetry
multi-user sync
cloud synchronization
encrypted storage
differential tile updates
5. User Stories
Core Stories
US-1

As a user,
I want viewed regions to remain available offline permanently,
so that I can access maps without internet.

US-2

As a user,
I want the map to render smoothly during zoom and pan,
so that field usability remains high.

US-3

As a user,
I want nearby areas to preload automatically,
so that offline exploration feels seamless.

US-4

As a system,
I want duplicate geometry data deduplicated,
so that storage usage remains efficient.

6. Technical Architecture
High-Level Architecture
┌─────────────────────┐
│ React Native / Web  │
│ MapLibre Renderer   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Tile Request Layer  │
│ Custom Protocol     │
└──────────┬──────────┘
           │
   ┌───────┴────────┐
   ▼                ▼
SQLite Cache    Network Fetch
(Local MBTiles) Remote Tile API
7. Technology Stack
Frontend
React Native
Expo
React Native Web
TypeScript
Map Rendering
MapLibre GL JS
MapLibre React Native
Tile Format
Vector Tiles (PBF)
Tile Packaging
MBTiles-compatible SQLite schema
Database
SQLite

Recommended:

Expo SQLite
OR
react-native-quick-sqlite
Tile Source
OpenMapTiles
OpenStreetMap-derived vector tiles
8. Geographic Scope

Initial supported region:

Delhi NCR

Approximate bounds:

Latitude: 28.40 → 28.90
Longitude: 76.80 → 77.40
9. Zoom Levels

MVP supported zoom:

10 → 16

Reason:

balances clarity and storage
sufficient for tactical city navigation
manageable offline package size
10. Tile System
Tile Coordinate System

Standard Slippy Map:

(z, x, y)

Where:

z = zoom level
x = horizontal tile index
y = vertical tile index
11. Storage Design
SQLite Schema
CREATE TABLE tiles (
    z INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    hash TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL,
    PRIMARY KEY (z, x, y)
);

CREATE TABLE tile_hashes (
    hash TEXT PRIMARY KEY,
    ref_count INTEGER NOT NULL
);
12. Why Vector Tiles

Chosen because:

smaller storage footprint
lower network cost
scalable zoom rendering
GPU acceleration
modern mapping standard
tactical GIS compatibility
13. Tile Lifecycle
Online Fetch Flow
Tile Requested
      ↓
Check SQLite Cache
      ↓
Cache Miss
      ↓
Fetch Tile from Network
      ↓
Deduplicate
      ↓
Store in SQLite
      ↓
Render via MapLibre
Offline Flow
Tile Requested
      ↓
Check SQLite Cache
      ↓
Cache Hit
      ↓
Return Tile
      ↓
Render Offline
14. Predictive Prefetching
Objective

Improve offline usability by proactively downloading nearby tiles likely to be needed next.

Strategy

When user views:

(z, x, y)

Also fetch:

adjacent tiles
+ next likely zoom level
Prefetch Radius

Example:

Current Tile:
(15, 24567, 12345)

Prefetch:
3x3 neighboring tiles
Benefits
smoother offline exploration
reduced visible loading
tactical continuity during movement
Risks
increased storage usage
increased network usage

Mitigation:

configurable prefetch radius
background throttling
15. Tile Deduplication
Problem

Many vector tiles contain identical geometry.

Without deduplication:

storage increases rapidly
Solution

Hash tile payload:

SHA-256(tile_data)

If hash exists:

reuse existing blob reference
increment ref_count
Benefits
reduced SQLite size
reduced duplication
improved storage scalability
Dedup Flow
Tile Downloaded
      ↓
Generate SHA-256
      ↓
Hash Exists?
   YES / NO
    ↓      ↓
Reuse    Store New Blob
16. Tile Compression
Compression Strategy

Vector PBF tiles are already compact, but additional:

gzip
brotli

may be applied.

Goal

Reduce:

network bandwidth
SQLite size
17. Rendering Pipeline
Renderer

MapLibre GL

Uses:

GPU rendering
vector tile rasterization on-device
Rendering Benefits
smooth zooming
crisp labels
scalable rendering
dynamic styling
18. Offline Tile Protocol
Requirement

MapLibre expects URL-based tile sources.

Solution

Implement custom protocol:

offline://z/x/y

Example:

offline://15/24567/12345
Tile Resolver

Protocol handler:

parses coordinates
checks SQLite
returns tile blob
19. Storage Estimates
Delhi Region Approximation

Zoom 10–16:

~200MB–800MB estimated

Depends on:

style complexity
layers
prefetch radius
20. Performance Requirements
Metric	Target
Tile fetch from SQLite	< 30ms
Initial map render	< 2s
Pan FPS	50–60 FPS
Offline tile hit rate	> 95%
App cold start	< 3s
21. Background Sync Strategy

MVP:

online-only fetch during interaction

Future:

background tile synchronization
scheduled region downloads
22. Security Considerations

MVP:

no encryption

Future:

encrypted SQLite
signed tile packs
secure tactical overlays
23. Scalability Roadmap
Phase 1 — MVP
Delhi only
online/offline cache
vector rendering
predictive prefetching
deduplication
Phase 2
region downloads
offline search
favorites/bookmarks
terrain overlays
Phase 3
satellite imagery
drone imagery overlays
tactical layers
encrypted offline storage
Phase 4
multi-user sync
mesh synchronization
edge deployments
real-time telemetry
24. Alternative Architectures Considered
Raster MBTiles

Rejected because:

massive storage growth
poor zoom scalability
blurry high zoom
expensive bandwidth usage
IndexedDB-only Web Cache

Rejected because:

weaker mobile support
poorer scalability
inconsistent persistence
25. Risks
Risk	Impact	Mitigation
SQLite growth	High	Deduplication
Battery usage	Medium	Background throttling
Large prefetching	Medium	Radius limits
Vector rendering cost	Medium	Zoom constraints
Tile corruption	Low	Integrity hashing
26. Success Metrics
MVP Success
viewed tiles remain accessible offline
identical zoom quality offline
smooth rendering across platforms
predictive loading works
storage remains manageable
27. Future Military Enhancements

Potential future tactical features:

MGRS support
terrain analysis
secure offline mission packs
drone video overlays
battlefield annotations
edge synchronization
encrypted tactical regions
28. Proposed Folder Structure
src/
├── components/
├── screens/
├── services/
│   ├── tiles/
│   ├── storage/
│   ├── hashing/
│   └── prefetch/
├── database/
├── protocols/
├── map/
├── hooks/
└── utils/
29. MVP Deliverables
Functional Deliverables
Cross-platform app
MapLibre integration
SQLite tile cache
Offline persistence
Tile prefetching
Tile deduplication
Technical Deliverables
architecture documentation
tile schema
caching strategy
storage metrics
30. Final Architectural Decision
Selected Architecture
Vector Tiles + MapLibre + SQLite (MBTiles-compatible)

Reasoning:

best balance of:
storage efficiency
rendering quality
bandwidth optimization
scalability
production realism
tactical applicability

This architecture aligns closely with:

modern Google Maps systems
tactical GIS systems
offline military mapping platforms
scalable geospatial applications.
