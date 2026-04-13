import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxVideoRecorder } from './ngx-video-recorder';

describe('NgxVideoRecorder', () => {
  let component: NgxVideoRecorder;
  let fixture: ComponentFixture<NgxVideoRecorder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxVideoRecorder],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxVideoRecorder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
