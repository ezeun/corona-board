import React from 'react';
import { Slide } from '../components/slide';

export default function SinglePage({ pageContext }) {
    const { dataSource } = pageContext;
    // 데이터 소스에서 원하는 필드 추출
    const { countryByCc, globalStats } = dataSource;
    // 각 필드를 로그로 출력
    console.log(countryByCc);
    console.log(globalStats);

    return (
        <div>
            <h1>코로나보드</h1>
            <Slide title="국가별 현황">국가별 현황을 보여줍니다.</Slide>
        </div>
    );
}

