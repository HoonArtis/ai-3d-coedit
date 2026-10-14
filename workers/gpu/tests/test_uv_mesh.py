import numpy as np
import pytest
from workers.gpu.uv_mesh import clean_uv_faces


@pytest.mark.parametrize('scale', [1e-6, 1, 1e6])
def test_removes_collapsed_faces_without_moving_valid_surface(scale):
    vertices = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0],
                         [0.5, 1e-14, 0]], dtype=float) * scale
    faces = np.array([[0, 1, 2], [0, 1, 3], [0, 0, 1]])
    original = faces.copy()
    result = clean_uv_faces(vertices, faces)
    np.testing.assert_array_equal(result, [[0, 1, 2]])
    np.testing.assert_array_equal(faces, original)


def test_checks_geometry_at_uvatlas_float32_precision():
    vertices = np.array([[1, 0, 0], [1 + 1e-8, 0, 0], [1, 1, 0], [2, 0, 0]])
    np.testing.assert_array_equal(clean_uv_faces(vertices, np.array([[0, 1, 2], [0, 3, 2]])), [[0, 3, 2]])


def test_rejects_empty_or_nonfinite_surface():
    with pytest.raises(ValueError, match='UV_MESH_EMPTY'):
        clean_uv_faces(np.zeros((3, 3)), np.array([[0, 1, 2]]))
    with pytest.raises(ValueError, match='UV_MESH_NONFINITE'):
        clean_uv_faces(np.full((3, 3), np.nan), np.array([[0, 1, 2]]))
