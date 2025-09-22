



import { Match, Official, Stadium, Location, OptimizationSettings } from '../types';
import JSZip from 'jszip';


// --- HELPER FUNCTIONS ---

function arrayToCsv(data: any[], columns: string[]): string {
  const header = columns.join(',') + '\n';
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col];
      if (val === null || val === undefined) {
        return '';
      }
      val = String(val);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  }).join('\n');
  return header + rows;
}

function getCoords(locationId: string | null, locationMap: Map<string, Location>): { lat: number | null, lon: number | null } {
    if (!locationId) return { lat: null, lon: null };
    const loc = locationMap.get(locationId);
    return { lat: loc?.latitude ?? null, lon: loc?.longitude ?? null };
}

// --- CSV GENERATION FUNCTIONS ---

export const generateOfficialsCsv = (
    officials: Official[],
    locations: Location[],
    settings: OptimizationSettings,
    matchesInScope: Match[]
): string => {
    const locationMap = new Map<string, Location>(locations.map(l => [l.id, l]));
    const gameDaysInScope = new Set(matchesInScope.map(m => m.gameDay));

    const data = officials
        .filter(o => o.isActive && !o.isArchived)
        .map(o => {
            const { lat, lon } = getCoords(o.locationId, locationMap);
            const grade = settings.categoryGradeMap[o.category] || 1;
            const capacity = settings.categoryCapacityMap[o.category] || 1;
            const current_load = matchesInScope.filter(m => gameDaysInScope.has(m.gameDay) && m.assignments.some(a => a.officialId === o.id)).length;

            return {
                id: o.id,
                name: o.fullName,
                lat,
                lon,
                grade,
                current_load,
                capacity_per_round: capacity
            };
    });
    
    return arrayToCsv(data, ['id', 'name', 'lat', 'lon', 'grade', 'current_load', 'capacity_per_round']);
};


export const generateMatchesCsv = (
    matches: Match[],
    locations: Location[],
    settings: OptimizationSettings
): string => {
    const locationMap = new Map<string, Location>(locations.map(l => [l.id, l]));

    const data = matches.map(m => {
        const { lat, lon } = m.stadium ? getCoords(m.stadium.locationId, locationMap) : { lat: null, lon: null };
        const required_delegates = m.assignments.filter(a => a.role.toLowerCase().includes('délégué')).length;
        const kickoff_dt = m.matchDate && m.matchTime ? `${m.matchDate}T${m.matchTime}` : null;
        
        return {
            id: m.id,
            round: m.gameDay,
            stadium_id: m.stadium?.id ?? null,
            lat,
            lon,
            risk: settings.defaultMatchRisk,
            required_delegates,
            kickoff_dt,
            duration_min: settings.matchDurationMin,
        };
    });
    
    return arrayToCsv(data, ['id', 'round', 'stadium_id', 'lat', 'lon', 'risk', 'required_delegates', 'kickoff_dt', 'duration_min']);
};


export const generateStadiumsCsv = (stadiums: Stadium[], locations: Location[]): string => {
    const locationMap = new Map<string, Location>(locations.map(l => [l.id, l]));
    const data = stadiums
      .filter(s => !s.isArchived)
      .map(s => {
        const { lat, lon } = getCoords(s.locationId, locationMap);
        return { id: s.id, name: s.name, lat, lon };
    });
    return arrayToCsv(data, ['id', 'name', 'lat', 'lon']);
};

export const generateAvailabilityCsv = (officials: Official[], matches: Match[]): string => {
    const data: { official_id: string, match_id: string, available: 0 | 1 }[] = [];
    
    for (const official of officials) {
        if (!official.isActive || official.isArchived) continue;
        for (const match of matches) {
            if (!match.matchDate) {
                data.push({ official_id: official.id, match_id: match.id, available: 1 }); // Assume available if match date not set
                continue;
            }

            const matchDate = new Date(match.matchDate);
            matchDate.setHours(12, 0, 0, 0);

            const isUnavailable = official.unavailabilities.some(unav => {
                const start = new Date(unav.startDate);
                const end = new Date(unav.endDate);
                start.setHours(12, 0, 0, 0);
                end.setHours(12, 0, 0, 0);
                return matchDate >= start && matchDate <= end;
            });
            
            data.push({
                official_id: official.id,
                match_id: match.id,
                available: isUnavailable ? 0 : 1
            });
        }
    }
    return arrayToCsv(data, ['official_id', 'match_id', 'available']);
};

export const generateForbiddenCsv = (): string => {
    const data: any[] = [];
    return arrayToCsv(data, ['official_id', 'match_id', 'forbidden']);
};

export const downloadOptimizationDataAsZip = async (csvData: Record<string, string>) => {
    const zip = new JSZip();
    for (const [filename, content] of Object.entries(csvData)) {
        zip.file(filename, content);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `optimization_data_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};