"""Remove numerically collapsed triangles before Open3D's float32 UVAtlas call."""
import numpy as np


def clean_uv_faces(vertices, faces):
    # Match UVAtlas's position precision, then measure in float64 to avoid
    # cross-product underflow. Normalize so object units do not change the test.
    positions = np.asarray(vertices, dtype=np.float32).astype(np.float64)
    faces = np.asarray(faces)
    if not np.isfinite(positions).all():
        raise ValueError('UV_MESH_NONFINITE')
    if not len(positions) or not len(faces):
        raise ValueError('UV_MESH_EMPTY')
    extent = np.ptp(positions, axis=0).max()
    if extent == 0:
        raise ValueError('UV_MESH_EMPTY')
    triangles = ((positions - positions.min(axis=0)) / extent)[faces]
    area2 = np.linalg.norm(np.cross(triangles[:, 1] - triangles[:, 0],
                                    triangles[:, 2] - triangles[:, 0]), axis=1)
    keep = area2 > 1e-10
    if not keep.any():
        raise ValueError('UV_MESH_EMPTY')
    if not keep.all():
        print(f'UV mesh cleanup: removed {int((~keep).sum())}/{len(faces)} collapsed triangles', flush=True)
    return faces[keep]
