import L from 'leaflet';
import { Fragment } from 'react';
import { Circle, Marker } from 'react-leaflet';
import { boundsAround } from '../../lib/geo/distance';
import { useLocationStore } from '../../store/location';

// 아이콘은 모양이 바뀌지 않으므로 한 번만 만듦
const dotIcon = L.divIcon({
  html: '<div class="my-location-dot"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// 매번 새 아이콘을 만들면 react-leaflet이 렌더링마다 아이콘을 갈아 끼우므로 반경별로 한 번만 만듦
const labelIcons = new Map<number, L.DivIcon>();
const labelIcon = (km: number) => {
  let icon = labelIcons.get(km);
  if (!icon) {
    icon = L.divIcon({
      html: `<span>${km}km</span>`, // 숫자만 들어가는 고정 형식이라 안전
      className: 'radius-label',
      iconSize: [0, 0],
    });
    labelIcons.set(km, icon);
  }
  return icon;
};

/**
 * 반경 원과 내 위치 점 (목업: 바깥 원은 점선, 안쪽 원은 실선, 원 위쪽에 "20km" 라벨).
 * - 위치를 기다리는 동안에는 모두 숨김 (기본 위치를 내 위치처럼 보이지 않게)
 * - 기본 위치일 때는 반경 원만 보여 주고 내 위치 점은 숨김
 */
export const MyLocationLayer = ({ radiusKm }: { radiusKm: number }) => {
  const status = useLocationStore((s) => s.status);
  const lat = useLocationStore((s) => s.lat);
  const lon = useLocationStore((s) => s.lon);
  if (status === 'pending') return null;

  const center: [number, number] = [lat, lon];
  // 기본은 10km, 20km. 반경을 30km로 넓히면 30km 원을 하나 더 그림
  const rings = radiusKm > 20 ? [10, 20, radiusKm] : [10, radiusKm];

  return (
    <>
      {rings.map((km) => {
        const outer = km === radiusKm;
        const north = boundsAround({ lat, lon }, km)[1][0];
        return (
          <Fragment key={km}>
            <Circle
              center={center}
              radius={km * 1000}
              interactive={false}
              pathOptions={{
                color: '#1A54E6',
                weight: 1.5,
                dashArray: outer ? '6 5' : undefined,
                fillColor: '#1A54E6',
                fillOpacity: outer ? 0.035 : 0.05,
              }}
            />
            <Marker
              position={[north, lon]}
              icon={labelIcon(km)}
              interactive={false}
              keyboard={false}
              zIndexOffset={-1000} // 비행기 마커와 겹치면 비행기가 위에 보이게
            />
          </Fragment>
        );
      })}
      {status === 'granted' && (
        <Marker
          position={center}
          icon={dotIcon}
          interactive={false}
          keyboard={false}
          zIndexOffset={-1000} // 비행기 마커가 내 위치 점보다 위에 보이게
        />
      )}
    </>
  );
};
