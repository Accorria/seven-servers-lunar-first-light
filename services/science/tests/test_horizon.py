import numpy as np

from lfl.frames import azimuth_elevation, point_at_azimuth_elevation, spherical_to_me
from lfl.horizon import horizon_from_points, horizon_peak


def test_ridge_peak_within_tolerance():
    observer = spherical_to_me(0.0, -89.0, 1737.4)
    expected_azimuth = 90.0
    expected_elevation = 7.5
    ridge = point_at_azimuth_elevation(observer, expected_azimuth, expected_elevation, 5.0)
    recovered_azimuth, recovered_elevation = azimuth_elevation(observer, ridge)
    assert abs(recovered_elevation - expected_elevation) < 1e-6
    assert abs(((recovered_azimuth - expected_azimuth + 180) % 360) - 180) < 1e-6
    horizons = horizon_from_points(observer, np.array([ridge]))
    peak_azimuth, peak_elevation = horizon_peak(horizons)
    assert abs(peak_elevation - expected_elevation) < 0.2
    assert abs(((peak_azimuth - expected_azimuth + 180) % 360) - 180) < 0.5


def test_flat_sphere_is_below_horizontal():
    observer = spherical_to_me(10.0, -85.0, 1737.4)
    distant = spherical_to_me(12.0, -84.5, 1737.4)
    _, elevation = azimuth_elevation(observer, distant)
    assert elevation < 0.0


def test_stereographic_matches_proj_sign():
    from lfl.dem import inverse_stereographic, stereographic_xy

    longitude, latitude = inverse_stereographic(-11572.5, -12472.5)
    assert abs(latitude + 89.43890921454617) < 1e-6
    assert abs(longitude - 222.85643000554958) < 1e-6
    x_m, y_m = stereographic_xy(31.0, -84.6)
    assert x_m > 0 and y_m > 0


def test_raising_mast_does_not_increase_horizon():
    terrain = spherical_to_me(20.0, -80.0, 1737.4 + 2.0)
    low = spherical_to_me(15.0, -85.0, 1737.4)
    high = spherical_to_me(15.0, -85.0, 1737.4 + 0.05)
    _, low_elevation = azimuth_elevation(low, terrain)
    _, high_elevation = azimuth_elevation(high, terrain)
    assert high_elevation <= low_elevation + 1e-9
