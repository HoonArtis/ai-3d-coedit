from workers.gpu.adapters.images import reconstruction_prompt


def test_reconstruction_prompt_preserves_subject_and_exposes_depth():
    positive, negative = reconstruction_prompt('A blue whale-shaped bench')
    assert positive.startswith('A blue whale-shaped bench,')
    for required in ['three-quarter view', 'viewed diagonally from the side', 'slightly elevated',
                     'entire subject', 'margin', 'plain white background', 'single subject']:
        assert required in positive
    for forbidden in ['front view', 'close-up', 'cropped', 'multiple views', 'collage']:
        assert forbidden in negative


def test_does_not_turn_living_subjects_into_props():
    positive, _ = reconstruction_prompt('A cat')
    assert positive.startswith('A cat,')
    assert 'toy' not in positive and 'game prop' not in positive
