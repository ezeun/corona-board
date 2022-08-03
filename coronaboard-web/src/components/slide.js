import React from 'react'; // react 임포트
import { css } from '@emotion/react';

export function Slide(props) { // Slide라는 이름의 함수형 컴포넌트 선언
    const { title, children } = props; // 부모 컴포넌트에서 전달받은 속성값 추출
    return ( // 이 컴포넌트가 렌더링될 형태 반환
        <div
            css={css`
                text-align: center;
                border-top: 1px solid #aaa;
                padding-top: 40px;
                padding-bottom: 60px;
            `}
        >
            <h2>{title}</h2>
            <div>{children}</div>
        </div>
    );
}